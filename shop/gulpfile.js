// see gulp-manpage-commands.txt
// or 'gulp help' for usage instructions

'use strict';

const LEONEX_GULPFILE_VERSION = '1.7.6';    // must match the version in package.json!


const gulp        = require('gulp');
const gutil       = require('gulp-util');
const gsequence   = require('gulp-sequence');
const plugins     = require('gulp-load-plugins');
const browser     = require('browser-sync');
const rimraf      = require('rimraf');
const del         = require('del');
const yargs       = require('yargs');
const lazypipe    = require('lazypipe');
const fs          = require('fs');
const eventStream = require('event-stream');
//const fsGlobOld   = require('glob-fs');
const fsGlob      = require('glob');
const path        = require('path');
const streamqueue = require('streamqueue');
const mergestream = require('merge-stream');
const lec         = require('gulp-line-ending-corrector');
const imageminJpg = require('imagemin-jpeg-recompress');
const imageminPng = require('imagemin-pngquant');
const escapeStringRegexp = require('escape-string-regexp');
const mergeOptions = require('merge-options');
const ftp         = require('vinyl-ftp');

const autoprefixer     = require('autoprefixer');
const postcssInlineSvg = require('postcss-inline-svg');
const postcssSvgo      = require('postcss-svgo');
const postcssCsso      = require('postcss-csso');

const $ = plugins();


if( !checkMatchingPackageJsonVersion() ) {
    gutil.log("<ERROR> Version of your gulpfile does not match version in package.json,");
    gutil.log("        please verify integrity of your gulp project setup (forgot to copy a file while updating?).");
    return;
}


const CONFIG_DEFAULTS = {
    frontends: {
        "active": true,
        "css_preprocessor": "sass",
        "js_breakpoints": {
            "css_source_file": null,
            "variable_name": "breakpoints"
        },
        "js_inline": true,
        "folders": {
            //"basedir": "./frontend",
            "src": "src",
            "bower": "bower_components",
            "node": "node_modules",
            "vendorXXX": "vendor WHAT IS DIS?",
            "sources": {
                "sass":     "sass",
                "less":     "less",
                "pug":      "templates",
                "js":       "scripts",
                "images":   "images",
                "fonts":    "fonts",
                "favicons": "favicons"
            },
            "destinations": {
                "sass":     "css",
                "less":     "css",
                "pug":      "",
                "js":       "js",
                "images":   "images",
                "fonts":    "fonts",
                "favicons": "favicons",
                "vendor":   "vendor"
            },
            "build": {
                "prod": "build_prod",
                "dev": "build_dev"
            }
        },
        "vendor_js_concatenation": [],
        "ftp_directory": null
    },
    targets: null
};



const DEBUG = !!yargs.argv.debug;

// get the task name that should be executed ("gulp TASK params..." on command line)
const TASK = (function() {
    var task = (process.argv.length >= 3 && process.argv[2].charAt(0) != '-') ? process.argv[2] : null;

    if( task == 'graph' && typeof yargs.argv.task !== 'undefined' ) {
        // include/init gulp-graph package
        require('gulp-graph')(gulp);

        return yargs.argv.task; // return task given in parameter "--task=X" to be "simulated" for plot generation
    }
    else {
        return task;
    }
}());


// Look for the --production flag
// if task copy is executed, production default value is false instead of true!
const PRODUCTION = (function() {
    if( TASK == 'copy' ) {
        if( !!yargs.argv.development ) {
            return false;
        }

        if( typeof yargs.argv.production === 'undefined' ) {
            return true;
        }
    }

    return !!yargs.argv.production;
}());

// look for the --target flag
const TARGET = yargs.argv.target || yargs.argv.t || (TASK == 'copy' ? 'all' : null);

// make sure only target OR frontend is set
const FRONTEND = TARGET ? null : (yargs.argv.frontend || yargs.argv.f || null);

// linting flag default is true, except when task copy is executed
const FLAG_LINTING = (TASK == 'copy' ? !!yargs.argv.linting : (yargs.argv.linting || typeof yargs.argv.linting === 'undefined'));
// images flag default is true
const FLAG_IMAGES = yargs.argv.images  || typeof yargs.argv.images === 'undefined';


const SUPPORTED_CSS_PREPOCESSORS = ['sass', 'less'];


const config = loadConfiguration(TARGET || 'all');



const noopTaskFunction = function(cb) { cb(); };


// "gulp build --target foobar" is not valid
if( TASK == 'build' && TARGET ) {
    gutil.log("Can't pass a target to task 'build' (only one or more frontends)");
    return;
}

// "gulp copy --frontend foobar" is not valid
if( TASK == 'copy' ) {
    var frontendTest = yargs.argv.frontend || yargs.argv.f || null;
    if( frontendTest !== null && frontendTest !== 'all' ) {
        gutil.log("Can't pass a frontend to task 'copy' (only one or more targets)");
        return;
    }
}


gulp.task('default', ['help'], function(cb) { cb(); });


gulp.task('install-frontend-dependencies', function(cb) {
    var shell = require('shelljs');
    
    Object.keys(config.frontends).forEach(function(frontendIdentifier) {
        var frontendBasedir = config.frontends[frontendIdentifier].folders.basedir;

        if( !fs.existsSync(frontendBasedir + '/package.json') ) {
            return;
        }

        gutil.log("Installing dependencies for frontend '"+frontendIdentifier+"' ...");
        
        shell.exec('yarn install --frozen-lockfile --production --non-interactive', {cwd: frontendBasedir});

        /*cp.spawnSync(
            'yarn',
            ['install', '--frozen-lockfile', '--production', '--non-interactive'],
            { env: process.env, cwd: frontendBasedir, stdio: 'inherit'}
        );*/

        gutil.log("Installing dependencies for frontend '"+frontendIdentifier+"' done.");
    });
});


/*
var activeFrontend = 'default';

function getActiveFrontendConfig() {
    return config.frontends[activeFrontend];
}
*/

var ftpUploadConfig = {
    host: 'design.leonex.de',
    user: 'www-design',
    password: null
}

var frontendDependencies = Object.keys(config.frontends);
var targetDependencies = [];

if( TARGET ) {
    frontendDependencies = getRequiredFrontendBuilds(config);

    if( TARGET == 'all' ) {
        targetDependencies = Object.keys(config.targets);

        // remove inactive targets
        targetDependencies = targetDependencies.filter(function(targetIdentifier) {
            if( typeof config.targets[targetIdentifier].active === 'undefined' ) {
                return true;
            }

            return !!config.targets[targetIdentifier].active;
        });

        if( targetDependencies.length == 0 ) {
            gutil.log('<ERROR> no active target exists');
            return;
        }
    }
    else {
        var requestedTargets = TARGET.split(',');

        targetDependencies = Object.keys(config.targets).filter(function(el) {
            return requestedTargets.indexOf(el) > -1;
        });
    }
}
else if( FRONTEND ) {
    var requestedFrontends = FRONTEND.split(',');

    frontendDependencies = frontendDependencies.filter(function(el) {
        return requestedFrontends.indexOf(el) > -1;
    });

    if( frontendDependencies.length == 0 ) {
        gutil.log("<ERROR> frontend '" + FRONTEND + "' does not exist");
        return;
    }
}

if( !TARGET ) {
    // remove inactive frontends
    frontendDependencies = frontendDependencies.filter(function(frontendIdentifier) {
        if( typeof config.frontends[frontendIdentifier].active === 'undefined' ) {
            return true;
        }

        return !!config.frontends[frontendIdentifier].active;
    });

    if( frontendDependencies.length == 0 ) {
        gutil.log('<ERROR> no active frontend exists');
        return;
    }
}

//frontendDependencies.forEach(function(frontendIdentifier) {
Object.keys(config.frontends).forEach(function(frontendIdentifier) {
    /* ** WiP frontend dependencies
    completeFrontendDependencies(frontendIdentifier);
    */

    //config.frontends[frontendIdentifier].css_preprocessor ;

    if( typeof config.frontends[frontendIdentifier].css_preprocessor === 'undefined' ) {
        config.frontends[frontendIdentifier].css_preprocessor = SUPPORTED_CSS_PREPOCESSORS[0];
    }
    else if( SUPPORTED_CSS_PREPOCESSORS.indexOf(config.frontends[frontendIdentifier].css_preprocessor) <= -1 ) {
        var unsupported = config.frontends[frontendIdentifier].css_preprocessor;

        config.frontends[frontendIdentifier].css_preprocessor = SUPPORTED_CSS_PREPOCESSORS[0];

        gutil.log(
            "<ERROR> css preprocessor '" + unsupported + "' is not supported, " +
            "falling back to '" + config.frontends[frontendIdentifier].css_preprocessor + "'"
        );
    }

    config.frontends[frontendIdentifier].assembleDest = function(destPath) {
        var frontendFolders = config.frontends[frontendIdentifier].folders;
        var prefix = PRODUCTION ? frontendFolders.build.prod : frontendFolders.build.dev;
        return (frontendFolders.basedir + '/' + prefix + '/' + destPath).replace('//', '/');
        //return path.posix.normalize(frontendFolders.basedir + '/' + prefix + '/' + destPath);
    }

    config.frontends[frontendIdentifier].globs = buildFrontendGlobs(config.frontends[frontendIdentifier]);
    //logObject(config.frontends[frontendIdentifier].globs);
});


if( TASK && ['default', 'help', 'install-frontend-dependencies'].indexOf(TASK) === -1 ) {
    outputRunInfo();
}


// debug stuff
logObject(frontendDependencies, 'frontendDependencies:');
logObject(TASK, 'TASK:');
logObject(config, 'config:');




function outputRunInfo() {
    var info = '';

    info += "LEONEX Master Gulpfile v" + LEONEX_GULPFILE_VERSION + "\n";
    info += "Task execution info:\n";
    info += "Task: " + TASK + " (" + (PRODUCTION ? 'production' : 'development') + ")\n";
    info += TASK.charAt(0).toUpperCase() + TASK.slice(1) + "ing ";
    if( TARGET ) {
        info += "for target(s) " + TARGET + "\n";
        info += 'Required frontends for this: ' + frontendDependencies.join(', ') + "\n";
    }
    else if( FRONTEND ) {
        info += "frontend(s) " + FRONTEND + "\n";
        info += "(no target copying)\n";
    }
    else {
        switch( TASK ) {
            case 'build': info += "all (active) frontends\n(no target copying)\n"; break;
            case 'watch': info += "all (active) frontends\n(no target copying)\n"; break;
            case 'copy': info += "to all (active) targets\n"; break;
        }
    }

    if( !FLAG_LINTING ) info += "--no-linting active: no javascript linting\n";
    if( !FLAG_IMAGES  ) info += "--no-images active: no image processing/copying\n";

    gutil.log(info);
}

function help(done) {
    gutil.log("Usage / Man page:\n\n" + fs.readFileSync('./gulp-manpage-commands.txt', 'utf-8'));

    done();
}
gulp.task('help', help);


function checkMatchingPackageJsonVersion() {
    var packageJson = readJsonFile('package.json');

    try {
        return packageJson.version === LEONEX_GULPFILE_VERSION;
    }
    catch( e ) {
        return false;
    }
}


function serverFactory(config) {
    // Start a server with LiveReload to preview the site in
    var env = PRODUCTION ? 'prod' : 'dev';
    var dir = (typeof config !== 'undefined' && config) ? config.folders.basedir + '/' + config.folders.build[env] : null;

    return function(done) {
        browser.init({
            server: dir != null ? dir : './',
            directory: dir == null,
            browser: null,
            open: false,
            ghostMode: {
                location: true,
                clicks: false,
                forms: false,
                scroll: false
            }
        });
        done();
    };
}
//gulp.task('server', server);

function reload(done) {
    browser.reload();
    done();
}
gulp.task('reload', reload);

function fixWatchPath(path) {
    // used because gulp is otherwise not recognizing newly created files

    if( typeof path === 'string' ) {
        return (path.substr(0, 2) === './') ? path.substr(2) : path;
    }

    // path is an array
    return path.map(function(pathEntry) {
        if( pathEntry.substr(0, 2) === './' ) {
            return pathEntry.substr(2);
        }
        if( pathEntry.substr(0, 2) === '!./') {
            return '!' + pathEntry.substr(3);
        }

        return pathEntry;
    });
}
function watchProfiles() {
    var watches = [];

    frontendDependencies.forEach(function(frontend) {
        var configFrontend = config.frontends[frontend];

        Object.keys(buildTasks).forEach(function(task) {
            if( ['clean', 'afterBuild'].indexOf(task) > -1 ) return;

            var taskNameReload = concatTaskName(frontend, task, 'reload');
            //logObject(task, 'globs[task]');

            if( typeof configFrontend.globs[task] === 'undefined' ) return;
            if( !configFrontend.globs[task].watch ) return;


            var watchPaths = configFrontend.globs[task].watch;

            // handle build task dependencies between different frontends
            // known bug: watchers with frontends depending on another frontend, browser reload will be triggered twice
            if( typeof configFrontend.dependencies !== 'undefined' ) {
                var additionalWatchPaths = Object.keys(configFrontend.dependencies).filter(function(frontendDep) {
                   return configFrontend.dependencies[frontendDep].indexOf(task) > -1;
                }).map(function(frontendDep) {
                    return config.frontends[frontendDep].globs[task].watch;
                }).reduce(function(a,b) { return a.concat(b); }, []); // flatten

                Array.prototype.push.apply(watchPaths, additionalWatchPaths);
            }

            //logObject(watchPaths, 'watchPaths', true);

            gulp.watch(fixWatchPath(watchPaths), [taskNameReload]);

            watches.push(frontend + '_' + task);
        });
    });

    gutil.log('profiles: watching for changes in: ' + watches.join(', '));
}
gulp.task('watchProfiles', watchProfiles);



function createUploadTasks(frontendDependencies) {
    function checkFrontendUploadDirectory(ftpDirectory) {
        if( /(^htdocs\/)|\/htdocs\/|(\/htdocs$)/.test(ftpDirectory) ) {
            gutil.log("----------");
            gutil.log("<ERROR> config variable 'ftp_directory' should not contain the (root) 'htdocs' directory.");
            gutil.log("        This will be prepended automatically.");
            gutil.log("----------");
            return false;
        }

        if( ftpDirectory.indexOf('/') < 1 ) {
            gutil.log("----------");
            gutil.log("<ERROR> config variable 'ftp_directory' must at least contain a folder and a subfolder in its path.");
            gutil.log("        (Safety measure to avoid accidental overwriting of files)");
            gutil.log("----------");
            return false;
        }

        return true;
    }

    var uploadTaskDependencies = [];

    //logObject(frontendDependencies, 'frontendDependencies', true);

    frontendDependencies.forEach(function(frontend) {
        var configFrontend = config.frontends[frontend];

        var task = null;

        if( configFrontend.ftp_directory ) {
            var base = configFrontend.folders.basedir;
            if( base.slice(-1) != '/' ) base += '/';

            var buildDirLocal = base + (PRODUCTION ? configFrontend.folders.build.prod : configFrontend.folders.build.dev);

            task = function(cb) {
                var ftpDirectory = configFrontend.ftp_directory.replace(/^(\/|\s)+|(\/|\s)+$/g, '');    // trim whitespace and slashes
                if( !checkFrontendUploadDirectory(ftpDirectory) ) {
                    cb();
                    return;
                }

                // TODO: implement checks for plausibility (no 'htdocs' prefix, dir depth etc.)
                var destDirRemote = '/htdocs/' + ftpDirectory;

                var infoUrl = 'https://design.leonex.de/' + ftpDirectory;

                var conn = ftp.create({
                    host:     ftpUploadConfig.host,
                    user:     ftpUploadConfig.user,
                    password: ftpUploadConfig.password, // will be set at this point of time
                    parallel: 1,
                    log:      gutil.log,
                    secure:   true,
                    secureOptions: {
                        rejectUnauthorized: false
                    }
                });

                // using base = will transfer directory structure correctly
                // turn off buffering in gulp.src for best performance

                var errorOccurred = false;

                return gulp.src(buildDirLocal + '/**/*', {base: buildDirLocal, buffer: false})
                    //.pipe(conn.newer(destDirRemote)) // only upload newer files
                    .pipe(conn.dest(destDirRemote))
                    .on('error', function(error) {
                        if( error.code == 530 ) {
                            gutil.log("----------");
                            gutil.log("<ERROR> Invalid password: FTP upload failed because the server rejected the supplied ftp user password.");
                            gutil.log("----------");

                            errorOccurred = true;
                        }
                    })
                    .on('finish', function() {
                        if( !errorOccurred ) {
                            gutil.log("----------");
                            gutil.log("FTP upload finished.");
                            gutil.log("URL for uploaded frontend '"+frontend+"': " + infoUrl);
                            gutil.log("----------");
                        }
                    });
            };
        }
        else {
            task = function(cb) {
                gutil.log("<ERROR> configuration value 'ftp_directory' for frontend '"+frontend+"' is not set");
                cb();
            };
        }


        var taskNameBuild  = concatTaskName(frontend, 'build');
        var taskNameUpload = concatTaskName(frontend, 'upload');

        createGulpTask(taskNameUpload, [taskNameBuild], task);

        uploadTaskDependencies.push(taskNameUpload);
    });

    return uploadTaskDependencies;
}



function createSupportTasks(buildTasks, targetDependencies) {
    var taskMatrix = {};

    frontendDependencies.forEach(function(frontend) {
        taskMatrix[frontend] = {};

        Object.keys(buildTasks).forEach(function(task) {
            taskMatrix[frontend][task] = (task == 'clean') ? {} : {
                copy: [], // array of copy instructions
                clean: [] // array of frontend identifiers
            };
        });

        taskMatrix[frontend]['afterBuild'] = {
            copy: []
        };
    });



    /*
    logObject("--frontendDependencies--");
    logObject(frontendDependencies);
    logObject("--/frontendDependencies--");
    */

    /*
    logObject("--targetDependencies--");
    logObject(targetDependencies);
    logObject("--/targetDependencies--");
    */


    //if( TARGET ) {
        targetDependencies.forEach(function(target) {
            var configTarget = config.targets[target];

            /*
            if( TASK == 'copy' ) {
                targetCleaning[target] = {};
            }
            */

            /*
            logObject("--configTarget--");
            logObject(configTarget);
            logObject("--/configTarget--");
            */

            if( typeof configTarget.copy !== 'undefined' && isArray(configTarget.copy) ) {
                configTarget.copy.forEach(function(copyInstruction) {
                    var frontend = typeof copyInstruction.frontend !== 'undefined' ? copyInstruction.frontend : 'default';
                    var profile = typeof copyInstruction.profile !== 'undefined' ? matchProfileToTask(copyInstruction.profile) : 'afterBuild';

                    if( typeof taskMatrix[frontend] === 'undefined' ) {
                        gutil.log('WARNING: frontend "'+frontend+'" does not exist (referenced in configuration of build target "'+target+'")');
                        return;
                    }
                    if( typeof taskMatrix[frontend][profile] === 'undefined' ) {
                        gutil.log('WARNING: profile (task) "'+profile+'" does not exist (referenced in configuration of build target "'+target+'")');
                        return;
                    }

                    // copy object and extend with target info
                    var instruction = Object.assign({}, copyInstruction, {target: target});

                    taskMatrix[frontend][profile].copy.push(instruction);


                    if( TASK == 'copy' ) {
                        if( typeof taskMatrix[frontend][profile].clean !== 'undefined' && taskMatrix[frontend][profile].clean.indexOf(target) === -1 ) {
                            taskMatrix[frontend][profile].clean.push(target);
                        }
                        /*
                        if( typeof targetCleaning[target][profile] !== 'undefined' || !isArray(targetCleaning[target][profile]) ) {
                            targetCleaning[target][profile] = [];
                        }

                        targetCleaning[target][profile].push(frontend);
                        */
                    }
                });
            }
        });
    //}

    var taskNameTargetClean = (TASK == 'copy') ? createTargetCleanTask(taskMatrix, targetDependencies) : false;


    /*
    logObject("==TASKMATRIX==");
    logObject(taskMatrix);
    logObject("==/TASKMATRIX==");
    */

    var buildTaskDependencies = [];
    var copyTaskDependencies = [];
    var watchProfileDependencies = {};

    for( var frontend in taskMatrix ) {
        if( !taskMatrix.hasOwnProperty(frontend) ) continue;

        var frontendBuildTaskDependencies = [];

        for( var task in taskMatrix[frontend] ) {
            if( !taskMatrix[frontend].hasOwnProperty(task) ) continue;

            var taskNameBuild  = concatTaskName(frontend, task);
            var taskNameReload = concatTaskName(frontend, task, 'reload');
            var taskNameCopy   = concatTaskName(frontend, task, 'copy');

            var buildDependency = createTaskBuildDependencies(frontend, task);

            /*if( buildDependency.length == 0 ) {
                buildDependency.push(concatTaskName(frontend, 'clean'));
            }*/

            //logObject(buildDependency, 'buildDependency of ' + frontend + '_' + task, true);

            createGulpTask(taskNameBuild, buildDependency, buildTasks[task](config.frontends[frontend]));

            if( task == 'clean' ) {
                continue;
            }

            if( task != 'afterBuild' ) {
                frontendBuildTaskDependencies.push(taskNameBuild);
            }


            if( ['watch', 'copy'].indexOf(TASK) > -1 ) {
                var copyInstructions = taskMatrix[frontend][task].copy;

                // get "aliases"/dependencies and add their build tasks as copy task dependencies here
                var deps = arrayUnique(
                    profileCopyGroups.filter(function(list) {    // look for groups that include the task
                        return list.indexOf(task) > -1;
                    }).reduce(function(list, value) {   // flatten the resulting groups into a single array of task names
                        return list.concat(value);
                    }, [])
                );

                var groupCopyInstructionsCount = (deps.length == 0) ? -1 : deps.reduce(function(count, profile) {
                    return count + taskMatrix[frontend][profile].copy.length;
                }, 0);

                /**
                 * oOe of the these three reasons must be given to include this copy task and therefore its corresponding build task in the build process:
                 * 1. This task has copy instructions configured.
                 * 2. There exists a copy instruction for one of the related tasks/profiles
                 *    in any of the profile copy groups that include the current task.
                 *    There will be many "empty" copy tasks that perform no copy instruction, but who cares.
                 * 3. There exists a copy instruction with profile "afterBuild", because then
                 *    ALL tasks have to be build (aka the complete frontend), as we do not know
                 *    which files of the built frontend are subject to the copy instruction.
                 */
                if( copyInstructions.length > 0 || groupCopyInstructionsCount > 0 || taskMatrix[frontend]['afterBuild'].copy.length > 0 ) {

                    var depsTaskNames = deps.map(function(profile) {     // map to task build names
                        return concatTaskName(frontend, profile);
                    });

                    if( depsTaskNames.length < 1 ) {
                        depsTaskNames = [taskNameBuild];
                    }

                    if( taskNameTargetClean ) {
                        depsTaskNames.push(taskNameTargetClean);
                    }

                    // dependencies connect all copy tasks with all build tasks within the profile copy group
                    createGulpTask(taskNameCopy, depsTaskNames, (function(copyInstructions, frontend) {
                        return function(callback) {
                            //logObject(copyInstructions, 'copyInstructions');

                            var copyStreams = copyInstructions.map(function(cp) {
                                return buildTargetCopyInstructionTask(cp, frontend);
                            });

                            /*copyStreams.forEach(function(el) {
                                gutil.log('copyStreams: ');
                                logObject(el);
                            });*/

                            return mergestream(copyStreams);
                        };
                    }(copyInstructions, frontend)));

                    copyTaskDependencies.push(taskNameCopy);



                    if( TASK == 'watch' ) {
                        // dependencies connect all reload tasks with all copy tasks within the profile copy group
                        var reloadDeps = deps.map(function(profile) {
                            //if( taskMatrix[frontend][profile].copy.length > 0 ) {
                                return concatTaskName(frontend, profile, 'copy');
                            //}
                            //return concatTaskName(frontend, profile, 'reload');
                        });

                        createGulpTask(taskNameReload, reloadDeps, reload);
                    }
                }
                else if( TASK == 'watch' ) {
                    createGulpTask(taskNameReload, [taskNameBuild], reload);
                }
            }
        }

        // frontend build task
        var taskNameBuild = concatTaskName(frontend, 'build');
        var taskNameAfterBuild = concatTaskName(frontend, 'afterBuild');

        //var cleanDependency = Object.keys(buildTasks).indexOf('clean') > -1 ? [concatTaskName(frontend, 'clean')] : [];
        //createGulpTask(taskNameBuild, cleanDependency, rerunnableGulpSequence(frontendBuildTaskDependencies, taskNameAfterBuild));

        /**
         * create the following task chain:
         * [dedicated asset type build tasks] -> afterBuild -> build
         */
        createGulpTask(taskNameAfterBuild, frontendBuildTaskDependencies, noopTaskFunction);
        createGulpTask(taskNameBuild, [taskNameAfterBuild], noopTaskFunction);
        //createGulpTask(taskNameBuild, frontendBuildTaskDependencies, rerunnableGulpSequence(taskNameAfterBuild));
        buildTaskDependencies.push(taskNameBuild);

        //logObject("DEBUG frontendBuildTaskDependencies");
        //logObject(frontendBuildTaskDependencies);
    }


    createGulpTask('build', buildTaskDependencies, function(cb) { cb(); });


    if( TASK == 'copy' ) {
        var afterBuildCopyTasks = Object.keys(taskMatrix).filter(function(frontend) {
            return taskMatrix[frontend]['afterBuild'].copy.length > 0;
        }).map(function(frontend) {
            return concatTaskName(frontend, 'afterBuild', 'copy');
        });

        createGulpTask('copy', copyTaskDependencies, rerunnableGulpSequence(afterBuildCopyTasks));
    }

    if( TASK == 'watch' ) {
        var configFrontend = frontendDependencies.length == 1 ? config.frontends[frontendDependencies[0]] : null;

        createGulpTask('server', serverFactory(configFrontend));

        createGulpTask('watch', rerunnableGulpSequence('server', 'watchProfiles'));

        //createGulpTask('watch', rerunnableGulpSequence(serverTask, watchProfiles));
        //createGulpTask('watch', function(callback) { gsequence(serverTask, watchProfiles)(callback); })
        //gulp.task('watch', rerunnableGulpSequence(serverTask, watchProfiles));
        //gulp.task('watch', function(callback) { gsequence('server', 'watchProfiles')(callback); });
    }

    if( TASK == 'ftp' ) {
        var uploadTaskDependencies = createUploadTasks(frontendDependencies);

        createGulpTask('upload_credentials', [], function() {
            return gulp.src('package.json')
                .pipe($.prompt.prompt({
                    type: 'password',
                    name: 'pass',
                    message: 'Please enter password for www-design@design.leonex.de:'
                }, function(res) {
                    // res.pass
                    ftpUploadConfig.password = res.pass;
                }));
        });

        createGulpTask('ftp', ['upload_credentials'], rerunnableGulpSequence.apply(this, uploadTaskDependencies));
    }
}


function createTaskBuildDependencies(frontend, task, isImplicitFrontend) {
    // handle build task dependencies between different frontends + clean task

    isImplicitFrontend = isImplicitFrontend || false;

    if( ['clean', 'afterBuild'].indexOf(task) > -1 ) return [];

    var configFrontend = config.frontends[frontend];

    //if( typeof configFrontend.dependencies === 'undefined' ) return [];


    // TODO:
    // configFrontend.copy durchlaufen, alle copy instructions nach profile aufschlüsseln,
    // und ca. in +39 Zeilen parallel zum Build-Task ausführen (via rerunnableGulpSequence)

    /* ** WiP frontend dependencies
    var copyInstructions = [];

    if( typeof configFrontend.copy !== 'undefined' && isArray(configFrontend.copy) ) {
        copyInstructions = configFrontend.copy.filter(function(copyInstruction) {
            return task == matchProfileToTask(copyInstruction.profile);
        });
    }
    */



    var dependencies = [];

    if( typeof configFrontend.dependencies !== 'undefined' ) {

        for( var requiredFrontend in configFrontend.dependencies ) {
            if( !configFrontend.dependencies.hasOwnProperty(requiredFrontend) ) {
                continue;
            }

            if( typeof config.frontends[requiredFrontend] === 'undefined' ) {
                // TODO: error message
                gutil.log("<ERROR> build task dependency: frontend '" + requiredFrontend + "' does not exist");
                continue;
            }

            if( !isArray(configFrontend.dependencies[requiredFrontend]) ) {
                // TODO: error message
                gutil.log("<ERROR> build task dependency: frontend '" + frontend + "' dependency on frontend '" + requiredFrontend + "' is not an array");
                continue;
            }

            /*if( configFrontend.dependencies[requiredFrontend].indexOf(task) == -1 ) {
                continue;
            }*/

            configFrontend.dependencies[requiredFrontend].forEach(function(profile) {
                var profileTask = matchProfileToTask(profile);

                // find matching task, iteration instead of "indexOf test" needed because of "profile to task matching" (see matchProfileToTask)
                if( profileTask != task ) {
                    return;
                }

                var taskNameBuild = concatTaskName(requiredFrontend, profileTask);

                var subDependencies = createTaskBuildDependencies(requiredFrontend, profileTask, true);   // recursive

                var buildAction = buildTasks[profileTask](config.frontends[requiredFrontend]);


                /* ** WiP frontend dependencies
                if( copyInstructions.length > 0 ) {
                    var taskNameFrontendCopy = concatTaskName(requiredFrontend, profileTask, 'frontendCopyDependencies');

                    createGulpTask(taskNameFrontendCopy, subDependencies, (function(copyInstructions, frontend) {
                        return function(callback) {
                            var copyStreams = copyInstructions.map(function(cp) {
                                return buildFrontendCopyInstructionTask(cp, frontend);
                            });

                            return mergestream(copyStreams);
                        };
                    }(copyInstructions, frontend)));

                    subDependencies = [taskNameFrontendCopy];
                }
                */


                createGulpTask(taskNameBuild, subDependencies, buildAction);

                dependencies.push(taskNameBuild);
            });
        }

    }

    if( !isImplicitFrontend ) {
        dependencies.push(concatTaskName(frontend, 'clean'));
    }

    return dependencies;
}



function createTargetCleanTask(taskMatrix, targetDependencies) {
    //var taskNameTargetClean = concatTaskName(target, 'clean');

    var cleanTaskNames = [];

    targetDependencies.forEach(function(target) {
        var configTarget = config.targets[target];

        var targetCleanTaskNames = [];

        if( typeof configTarget.clean !== 'undefined' ) {
            for( var cleanTask in configTarget.clean ) {
                if( !configTarget.clean.hasOwnProperty(cleanTask) ) continue;

                var cleanDirs = [];

                // TODO: check if configTarget.clean[cleanTask] exists, add those entries to a list
                if( typeof configTarget.clean[cleanTask] !== 'undefined' ) {
                    var dirs = configTarget.clean[cleanTask];

                    if( isString(dirs) ) {
                        dirs = [dirs];
                    }
                    
                    if( isArray(dirs) ) {
                        dirs = dirs.map(function(dir) {
                            return (configTarget.basedir + '/' + dir.replace('%THEME%', configTarget.theme)).replace('//', '/');
                        });
                    }

                    cleanDirs = cleanDirs.concat(dirs);
                }


                //logObject(cleanDirs, 'cleanDirs = ');


                if( cleanDirs.length > 0 ) {
                    var taskNameTargetTaskClean = concatTaskName(target, 'copyClean', cleanTask);

                    createGulpTask(taskNameTargetTaskClean, (function(cleanDirs) {
                        return function(callback) {
                            //logObject(cleanDirs, 'now cleaning the following target directories: ');
                            cleanDirs.forEach(function(dir) {
                                gutil.log('cleaning instruction (in target, directory): ' + dir);
                            });
                            return del(cleanDirs, {force: true});
                        };
                    }(cleanDirs)));

                    targetCleanTaskNames.push(taskNameTargetTaskClean);
                }
            };
        }

        if( targetCleanTaskNames.length > 0 ) {
            var taskNameTargetClean = concatTaskName(target, 'copyClean');

            createGulpTask(taskNameTargetClean, targetCleanTaskNames, function(cb) { cb(); });

            cleanTaskNames.push(taskNameTargetClean);
        }
    });


    createGulpTask('copyClean', cleanTaskNames, function(cb) { cb(); });

    return 'copyClean';
}

function buildTargetCopyInstructionTask(copyInstruction, frontend) {
    //logObject(copyInstruction);
    var configTarget = config.targets[copyInstruction.target];
    var configFrontend = config.frontends[frontend];

    var isDirectoryCopy = typeof copyInstruction.dir !== 'undefined';

    var src = '';
    if( isDirectoryCopy ) {
        src = configFrontend.assembleDest('/' + copyInstruction.dir) + '/**/*';
    }
    else {
        src = configFrontend.assembleDest('/' + copyInstruction.file);
    }

    src = src.replace('//', '/');


    var dest = (configTarget.basedir + '/' + copyInstruction.to.replace('%THEME%', configTarget.theme)).replace('//', '/');


    var rename = gutil.noop();

    if( !isDirectoryCopy ) {
        var destParsed = path.posix.parse(dest);

        dest = destParsed.dir;

        rename = $.rename(function(path) {
            path.basename = destParsed.name;
            path.extname = destParsed.ext;
        });

        //var basename = path.posix.basename(dest);
        //var dirname  = path.posix.dirname(dest);

        gutil.log('copy instruction (to target, file): ' + src + ' => ' + destParsed.dir + '/' + destParsed.name + destParsed.ext);
    }
    else {
        gutil.log('copy instruction (to target, directory): ' + src + ' => ' + dest);
    }

    /*logObject({
        src: src,
        dest: dest
    });*/

    return gulp.src(src).pipe(rename).pipe(gulp.dest(dest));
}

/* ** WiP frontend dependencies
function buildFrontendCopyInstructionTask(copyInstruction, frontend) {
    //logObject(copyInstruction);
    var configFrontendSource = config.frontends[copyInstruction.frontend];
    var configFrontendDestination = config.frontends[frontend];

    var isDirectoryCopy = typeof copyInstruction.dir !== 'undefined';

    var src = '';
    if( isDirectoryCopy ) {
        src = configFrontendSource.assembleDest('/' + copyInstruction.dir) + '/**           /*';
    }
    else {
        src = configFrontendSource.assembleDest('/' + copyInstruction.file);
    }

    src = src.replace('//', '/');


    var dest = configFrontendDestination.assembleDest('/' + copyInstruction.to);

    dest = dest.replace('//', '/');


    var rename = gutil.noop();

    if( !isDirectoryCopy ) {
        var destParsed = path.posix.parse(dest);

        dest = destParsed.dir;

        rename = $.rename(function(path) {
            path.basename = destParsed.name;
            path.extname = destParsed.ext;
        });

        //var basename = path.posix.basename(dest);
        //var dirname  = path.posix.dirname(dest);

        gutil.log('copy instruction (to frontend, file): ' + src + ' => ' + destParsed.dir + '/' + destParsed.name + destParsed.ext);
    }
    else {
        gutil.log('copy instruction (to frontend, directory): ' + src + ' => ' + dest);
    }

    / *logObject({
        src: src,
        dest: dest
    });* /

    return gulp.src(src).pipe(rename).pipe(gulp.dest(dest));
}
*/


/* ** WiP frontend dependencies
function completeFrontendDependencies(frontend) {
    var configFrontend = config.frontends[frontend];

    logObject(configFrontend, 'config '+frontend+' start', true);

    if( typeof configFrontend.copy !== 'undefined' && isArray(configFrontend.copy) ) {
        configFrontend.copy.forEach(function(copyInstruction) {
            if( typeof configFrontend.dependencies[copyInstruction.frontend] === 'undefined' || !isArray(configFrontend.dependencies[copyInstruction.frontend]) ) {
                configFrontend.dependencies[copyInstruction.frontend] = [];
            }

            if( configFrontend.dependencies[copyInstruction.frontend].indexOf(copyInstruction.profile) == -1 ) {
                configFrontend.dependencies[copyInstruction.frontend].push(copyInstruction.profile);
            }
        });
    }

    logObject(configFrontend, 'config '+frontend+' end', true);
}
*/



function readJsonFile(file) {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function readJsonFiles(glob, identifierRegex) {
    var data = {};

    var files = fsGlob.sync(glob, {dot: false});
    //var files = fsGlobOld({gitignore: true}).readdirSync(glob);

    //logObject(glob, 'glob', true);
    //logObject(identifierRegex, 'identifierRegex', true);
    //logObject(files, 'files', true);

    files.forEach(function(configFile) {
        var identifier = configFile.match(identifierRegex);

        //logObject(identifier);

        if( identifier == null || identifier.length < 2 ) {
            gutil.log("LEONEX gulpfile error: invalid profile identifier, file '" + configFile + "'");
            return;
        }

        identifier = identifier.pop();

        try {
            data[identifier] = readJsonFile(configFile);
        }
        catch( e ) {
            gutil.log("LEONEX gulpfile error: JSON file read error in file '" + configFile + "':");
            //gutil.log(e);
            throw e;
        }
    });

    return data;
}

function loadConfiguration(target) {
    target = target || null;

    var config = {
        frontends: readJsonFiles('gulp.frontend.*.json', /^gulp\.frontend\.([a-z]\w*)\.json$/i),
        targets: {}
    };

    if( target ) {
        if( target == 'all' ) {
            config.targets = readJsonFiles('gulp.target.*.json', /^gulp\.target\.([a-z]\w*)\.json$/i);
        }
        else {
            var targets = escapeStringRegexp(target);
            if( targets.indexOf(',') >= 0 ) {
                targets = '{' + targets + '}';
            }

            config.targets = readJsonFiles('gulp.target.' + targets + '.json', /^gulp\.target\.([a-z]\w*)\.json$/i);
        }
    }


    // merge with config defaults
    for( var configType in config ) {
        if( !config.hasOwnProperty(configType) ) continue;

        if( !CONFIG_DEFAULTS[configType] ) continue;

        for( var configIdentifier in config[configType] ) {
            if( !config[configType].hasOwnProperty(configIdentifier) ) continue;

            config[configType][configIdentifier] = mergeOptions(CONFIG_DEFAULTS[configType], config[configType][configIdentifier]);
        }
    }

    //logObject(getFrontendDependencies());

    return config;
}

/*
function getFrontendDependencies() {
    var packageJson = readJsonFile('package.json');
    return (typeof packageJson.dependencies !== 'undefined') ? Object.keys(packageJson.dependencies) : [];
}
*/

function getRequiredFrontendBuilds(config) {
    var frontendDependencies = [];

    Object.keys(config.targets).forEach(function(targetIdentifier) {
        config.targets[targetIdentifier].copy.forEach(function(copyRequest) {
            var frontendIdentifier = (typeof copyRequest.frontend === 'undefined') ? 'default' : copyRequest.frontend;
            if( frontendDependencies.indexOf(frontendIdentifier) < 0 ) {
                if( typeof config.frontends[frontendIdentifier] === 'undefined' ) {
                    gutil.log("LEONEX gulpfile error: frontend dependency of target '" + targetIdentifier + "' invalid, frontend '"
                        + frontendIdentifier + "' does not exist");
                    return;
                }

                frontendDependencies.push(frontendIdentifier);
            }
        });
    });


    return frontendDependencies;
}


function rerunnableGulpSequence() {
    //var argsCopy = [].slice.call(arguments);
    //logObject(arguments, 'rerunnableGulpSequence arguments');
    var _arguments = arguments;
    return function(callback) { (gsequence.apply(this, _arguments))(callback); }
}

function createGulpTask() {
    //logObject(arguments);
    //logObject(typeof arguments[1]);
    var deps = arguments.length >= 2 && isArray(arguments[1]) && arguments[1].length > 0 ? arguments[1].join(', ') : '--';
    if( DEBUG ) {
        gutil.log("creating gulp task '" + arguments[0] + "', with task dependencies: " + deps);
    }
    return gulp.task.apply(gulp, arguments);
}


function concatTaskName() {
    return Array.prototype.join.call(arguments, '_');
}


// can't extend array prototype because node module 'css-tree' throws errors then
function arrayUnique(arr) {
    return arr.filter(function(value, index, self) {
        return self.indexOf(value) === index;
    });
}

function isArray(obj) {
    return Object.prototype.toString.call(obj) === '[object Array]';
}
function isString(obj) {
    return Object.prototype.toString.call(obj) === '[object String]';
}
function isFunction(obj) {
  return !!(obj && obj.constructor && obj.call && obj.apply);
}

function logObject(obj, title, force) {
    if( !DEBUG && force !== true ) return;

    if( typeof title === 'undefined' ) {
        title = '';
    }
    else {
        title += "\n";
    }

    gutil.log(title + JSON.stringify(obj, null, 4));
}






function buildFrontendGlobs(frontendConfig) {
    var base = frontendConfig.folders.basedir;
    if( base.slice(-1) != '/' ) base += '/';

    var srcDir   = base + frontendConfig.folders.src;
    var bowerDir = base + frontendConfig.folders.bower; // deprecated, only for legacy reasons
    var nodeDir  = base + frontendConfig.folders.node;

    var src = frontendConfig.folders.sources;
    var dest = frontendConfig.folders.destinations;

    var globs = {
        pug: {
            src:   [`${srcDir}/${src.pug}/*.{pug,jade}`],
            dest:  dest.pug, //'',
            watch: [`${srcDir}/${src.pug}/*.{pug,jade}`]
        },
        pugPartials: {
            src:   [`${srcDir}/${src.pug}/*.{pug,jade}`],
            dest:  dest.pug, //'',
            watch: [`${srcDir}/${src.pug}/*/**/*.{pug,jade}`, `!${srcDir}/${src.pug}/*.{pug,jade}`, `${srcDir}/${src.js}/inline/**/*.js`]
        },
        sass: {
            src:   [`${srcDir}/${src.sass}/*.scss`],
            dest:  '/' + dest.sass, //'/css',
            watch: [`${srcDir}/${src.sass}/**/*.{scss,sass,css}`]
        },
        less: {
            src:   [`${srcDir}/${src.less}/*.less`],
            dest:  '/' + dest.less, //'/css',
            watch: [`${srcDir}/${src.less}/**/*.{less,css}`]
        },
        js: {
            src:   [
                `${srcDir}/${src.js}/features/lib/*.js`,
                `${srcDir}/${src.js}/**/*.js`,
                `!${srcDir}/${src.js}/{separate,vendor,inline}/**/*`
            ],
            dest:  '/' + dest.js, //'/js',
            watch: [
                `${srcDir}/${src.js}/**/*.js`,
                `!${srcDir}/${src.js}/{separate,vendor,inline}/**/*`
            ]
        },
        jsSeparate: {
            src:   [`${srcDir}/${src.js}/separate/**/*.js`],
            dest:  '/' + dest.js, //'/js',
            watch: [`${srcDir}/${src.js}/separate/**/*.js`]
        },
        jsInline: {
            src:   [`${srcDir}/${src.js}/inline/**/*.js`],
            dest:  null,
            watch: null //[srcDir+'/scripts/inline/**/*.js']
        },
        images: {
            src:   [`${srcDir}/${src.images}/**/*.{png,gif,jpg,jpeg}`, `!${srcDir}/${src.images}/no-optimization/**/*`],
            dest:  '/' + dest.images, //'/images',
            watch: [`${srcDir}/${src.images}/**/*.{png,gif,jpg,jpeg}`, `!${srcDir}/${src.images}/no-optimization/**/*`]
        },
        imagesUnoptimized: {
            src:   [`${srcDir}/${src.images}/no-optimization/**/*.{png,gif,jpg,jpeg}`, `${srcDir}/${src.images}/**/*.{svg,ico}`],
            dest:  '/' + dest.images, //'/images',
            watch: [`${srcDir}/${src.images}/no-optimization/**/*.{png,gif,jpg,jpeg}`, `${srcDir}/${src.images}/**/*.{svg,ico}`]
        },
        fonts: {
            src:   [
                `${srcDir}/${src.fonts}/**/*`,
                `${bowerDir}/**/fonts/**/*.{otf,eot,svg,ttf,woff,woff2}`,
                `${nodeDir}/**/fonts/**/*.{otf,eot,svg,ttf,woff,woff2}`
            ],
            dest:  '/' + dest.fonts, //'/fonts',
            watch: [
                `${srcDir}/${src.fonts}/**/*`,
                //`${bowerDir}/**/fonts/**/*.{otf,eot,svg,ttf,woff,woff2}`, // causes problems on Windows
                //`${nodeDir}/**/fonts/**/*.{otf,eot,svg,ttf,woff,woff2}`   // causes problems on Windows
            ]
        },
        vendor: {
            src: [
                `${bowerDir}/**/*.{js,css,map,png,jpg,jpeg,gif,eot,svg,ttf,woff,woff2,otf}`,
                `${nodeDir}/**/*.{js,css,map,png,jpg,jpeg,gif,eot,svg,ttf,woff,woff2,otf}`,
                `!${bowerDir}/**/{src,less,scss,sass}/**`,
                `!${nodeDir}/**/{src,less,scss,sass}/**`
            ],
            dest:  '/' + dest.vendor, //'/vendor',
            watch: null
        },
        jsVendor: {
            src:   null,
            dest:  null,
            watch: [
                `${srcDir}/${src.js}/vendor/**/*`
                //`${bowerDir}/**/*.js`,    // causes problems on Windows
                //`${nodeDir}/**/*.js`      // causes problems on Windows
            ]
        },
        //vendor: {
        //    src:   [srcDir+'/scripts/vendor/**/*', '!'+srcDir+'/scripts/vendor/modified/**/*'],
        //    dest:  '/js/vendor',
        //    watch: [srcDir+'/scripts/vendor/**/*', '!'+srcDir+'/scripts/vendor/modified/**/*']
        //},
        //vendorModified: {
        //    src:   [srcDir+'/scripts/vendor/modified/**/*'],
        //    dest:  '/js/vendor/modified',
        //    watch: [srcDir+'/scripts/vendor/modified/**/*']
        //},
        favicons: {
            src:   [srcDir+'/favicons/**/*'],
            dest:  '/' + dest.favicons, //'/favicons',
            watch: [srcDir+'/favicons/**/*']
        }
    };

    SUPPORTED_CSS_PREPOCESSORS.forEach(function(preprop) {
        if( preprop == frontendConfig.css_preprocessor ) {
            globs['css'] = globs[preprop];
        }

        delete globs[preprop];
    });

    return globs;
}

function matchProfileToTask(profile) {
    switch( profile ) {
        case 'html':
        case 'jade':
            return 'pug';
        /*case 'css':
            return 'sass';*/
        case 'less':
        case 'sass':
            return 'css';
        case 'img':
            return 'images';
        case 'font':
            return 'fonts';
        case 'favicon':
            return 'favicons';
        default:
            return profile;
    }
}

// these tasks will be linked in copy and watch gulp tasks, to allow easier configuration in the frontend config file
// e.g. you do not need to use profile "jsSeparate", just "js", when copying a separately compiled js file
const profileCopyGroups = [
    ['pug', 'pugPartials'],
    ['images', 'imagesUnoptimized'],
    ['js', 'jsSeparate']
];


// ==========================================================
// ==================== gulp tasks logic ====================
// ==========================================================


var plumberDefault = {
    errorHandler: function(err) {
        gutil.log("" + err);
        this.emit('end');
    }
};

var jsLinting = !FLAG_LINTING ? gutil.noop : lazypipe()
    .pipe($.jshint, {esversion: 6})
    .pipe($.jscs, {fix: false})
    .pipe($.jscsStylish.combineWithHintResults)
    .pipe($.jshint.reporter, 'jshint-stylish');

var logFiles = function(prefix) {
    prefix = prefix || '';

    return eventStream.map(function(file, cb) {
        //logObject(file, 'file', true);
        gutil.log(prefix + '.' + file.path.replace(file.cwd, ''));
        cb(null, file);
    });
}


function generateJsBreakpointVariable(parametersFile, varName, cssPreprocessor) {
    var varPrefix = '';
    switch( cssPreprocessor || '' ) {
        case 'less': varPrefix = '@'; break;
        case 'sass': varPrefix = '\\$'; break;
    }

    var pattern = new RegExp('^[^\\/\n]*('+varPrefix+'screen-[a-z]{2}):\\s*([0-9]*px)', 'gm');

    ///gutil.log(pattern);

    var data = fs.readFileSync(parametersFile, 'utf8');
    var m;
    varName = varName || 'BREAKPOINTS';

    function slug(s) {
        return s.replace(new RegExp('^'+varPrefix+'screen-'), '').split(new RegExp('['+varPrefix+'\\s]')).join('');
    }
    function rmPx(s) {
        return parseInt(s.replace(/px$/, ''));
    }

    var objSizes = {};

    do {
        m = pattern.exec(data);
        if( m ) {
            ///logObject(m, 'm');
            var id = slug(m[1]);
            var px = rmPx(m[2]);
            objSizes[id] = px;
        }
    } while( m );

    var code = 'var ' + varName + ' = ' + JSON.stringify(objSizes) + ";\n\n";
    return code;
}

var buildTasks = {
    pug: function(config) {
        return function() {
            var dest = config.assembleDest(config.globs.pug.dest);

            var jsInlineInjectable = function() {
                return gulp.src(config.globs.jsInline.src)
                    .pipe(jsLinting())
                    //.pipe($.concat('all.js'))
                    .pipe($.if(PRODUCTION, $.uglify().on('error', gutil.log)));
            };

            return gulp.src(config.globs.pug.src)
                .pipe($.changed(dest, {extension: '.html'}))
                .pipe($.plumber(plumberDefault))
                .pipe($.pug({pretty: true, data: {env_dev: !PRODUCTION, min_file: PRODUCTION ? '.min' : ''}})/*.on('error', gutil.log)*/)
                .pipe($.if(config.js_inline, $.inject(jsInlineInjectable(), {
                    starttag: '<!--inject:inline:{{ext}}-->',
                    endtag: '<!--endinject-->',
                    transform: function(filePath, file) {
                        return '<script>' + file.contents.toString('utf8') + '</script>';
                    }
                })))
                //.pipe($.replace('<html>', getConditionalHtmlTag()))
                .pipe(gulp.dest(dest));
        };
    },
    pugPartials: function(config) {
        return function(cb) {
            /*vinyl.src(src).pipe(map(function(file, cb) {
                gutil.log('Compiling ' + file.path);
                cb(null, file);
            }));*/

            if( TASK != 'watch' ) {
                gutil.log("Not running task 'watch' => pugPartials execution disabled");
                return cb();
            }

            var jsInlineInjectable = function() {
                return gulp.src(config.globs.jsInline.src)
                    .pipe(jsLinting())
                    //.pipe($.concat('all.js'))
                    .pipe($.if(PRODUCTION, $.uglify().on('error', gutil.log)));
            };

            return gulp.src(config.globs.pugPartials.src)
                .pipe($.plumber(plumberDefault))
                .pipe($.pug({pretty: true, data: {env_dev: !PRODUCTION, min_file: PRODUCTION ? '.min' : ''}})/*.on('error', gutil.log)*/)
                .pipe($.if(config.js_inline, $.inject(jsInlineInjectable(), {
                    starttag: '<!--inject:inline:{{ext}}-->',
                    endtag: '<!--endinject-->',
                    transform: function(filePath, file) {
                        return '<script>' + file.contents.toString('utf8') + '</script>';
                    }
                })))
                //.pipe($.replace('<html>', getConditionalHtmlTag()))
                .pipe(gulp.dest(config.assembleDest(config.globs.pugPartials.dest)));
        };
    },
    css: function(config) {
        return function() {
            var handler = gutil.noop;

            switch( config.css_preprocessor ) {
                case 'sass':
                    handler = lazypipe().pipe(function() { return $.sass()/*.on('error', $.sass.logError)*/; });
                    break;
                case 'less':
                    handler = lazypipe().pipe(function() { return $.less()/*.on('error', console.error.bind(console))*/; });
                    break;
            }

            return gulp.src(config.globs.css.src)
                .pipe($.plumber(plumberDefault))
                .pipe(logFiles('Compiling sass file: '))
                .pipe($.if(!PRODUCTION, $.sourcemaps.init()))
                .pipe(handler())
                .pipe($.if(!PRODUCTION, $.sourcemaps.write({includeContent: false})))
                .pipe($.if(!PRODUCTION, $.sourcemaps.init({loadMaps: true})))
                //.pipe($.autoprefixer({cascade: true}))
                .pipe($.postcss([
                    autoprefixer,
                    postcssInlineSvg,
                    postcssSvgo,
                    postcssCsso
                ]))
                .pipe($.if(!PRODUCTION, $.sourcemaps.write('./')))
                /*.pipe($.if(PRODUCTION, $.csso({
                    restructure: false
                })))*/
                .pipe(lec({verbose:false, eolc: 'CRLF', encoding:'utf8'}))
                .pipe(gulp.dest(config.assembleDest(config.globs.css.dest)));
        };
    },
    js: function(config) {
        var cssBreakpoints = gutil.noop;

        if( isString(config.js_breakpoints.css_source_file) ) {
            var base = config.folders.basedir;
            if( base.slice(-1) != '/' ) base += '/';

            var srcDir = base + config.folders.src;

            var cssSourceFile = srcDir + '/' + config.css_preprocessor + '/' + config.js_breakpoints.css_source_file;

            if( fs.existsSync(cssSourceFile) ) {
                var jsVariableName = config.js_breakpoints.variable_name;

                if( /^[a-z_$][0-9a-z_$]*$/i.test(jsVariableName) ) {
                    cssBreakpoints = lazypipe().pipe(function() {
                        return $.insert.prepend(generateJsBreakpointVariable(cssSourceFile, jsVariableName, config.css_preprocessor));
                    });
                }
                else {
                    gutil.log("<ERROR> 'js_breakpoints.variable_name' does not contain a valid JS variable identifier");
                }
            }
            else {
                gutil.log("<ERROR> filepath stored in 'js_breakpoints.css_source_file' does not exist,");
                gutil.log("        looked for '" + cssSourceFile + "'.");
            }
        }

        return function() {
            return gulp.src(config.globs.js.src)
                .pipe($.plumber(plumberDefault))
                .pipe($.if(!PRODUCTION, $.sourcemaps.init()))
                .pipe(jsLinting())
                .pipe($.if(/^.+\.es6\.js$/, $.babel()))
                .pipe($.concat('all.js'))
                .pipe(cssBreakpoints())
                .pipe($.if(!PRODUCTION, $.sourcemaps.write('./')))
                .pipe($.if(PRODUCTION, $.uglify().on('error', gutil.log)))
                .pipe(lec({verbose:false, eolc: 'CRLF', encoding:'utf8'}))
                .pipe(gulp.dest(config.assembleDest(config.globs.js.dest)));
        };
    },
    jsSeparate: function(config) {
        return function() {
            return gulp.src(config.globs.jsSeparate.src)
                .pipe($.plumber(plumberDefault))
                .pipe($.if(!PRODUCTION, $.sourcemaps.init()))
                .pipe(jsLinting())
                .pipe($.if(/^.+\.es6\.js$/, $.babel()))
                .pipe($.if(!PRODUCTION, $.sourcemaps.write('./')))
                .pipe($.if(PRODUCTION, $.uglify().on('error', gutil.log)))
                .pipe(lec({verbose:false, eolc: 'CRLF', encoding:'utf8'}))
                .pipe(gulp.dest(config.assembleDest(config.globs.jsSeparate.dest)));
        };
    },
    clean: function(config) {
        return function(cb) {
            if( TASK != 'watch' ) {
                rimraf(config.assembleDest(''), cb);
            }
            else {
                gutil.log("Running task 'watch' => cleaning disabled");
                cb();
            }
        };
    },
    afterBuild: function(config) {
        return function(cb) {
            cb();
        };
    },

    images: function(config) {
        return function() {
            /*if( !FLAG_IMAGES ) {
                return gulp.src('.').pipe(gutil.noop());
            }*/

            return gulp.src(config.globs.images.src)
                .pipe($.plumber(plumberDefault))
                .pipe($.if(PRODUCTION && FLAG_IMAGES, $.imagemin([
                    $.imagemin.gifsicle({interlaced: false}),
                    imageminJpg({
                        accurate: true,
                        loops: 6,
                        min: 40,
                        max: 87,
                        target: 87,
                        quality: 'high'
                    }),
                    imageminPng()
                ], {
                    verbose: true
                })))
                .pipe(gulp.dest(config.assembleDest(config.globs.images.dest)))
                //.on('end', gutil.log)
                .on('error', gutil.log);
        };
    },
    imagesUnoptimized: function(config) {
        return function() {
            return gulp.src(config.globs.imagesUnoptimized.src)
                .pipe(gulp.dest(config.assembleDest(config.globs.imagesUnoptimized.dest)));
        };
    },
    fonts: function(config) {
        function preparePathForSubstringComparison(dir) {
            if( dir.slice(-1) != '/' ) dir += '/';

            // remove leading ./ for comparison with fully qualified path
            if( dir.slice(0, 2) == './' ) {
                dir = dir.slice(2);
            }

            return dir;
        }

        function convertWinToUnixSlashes(path) {
            return path.replace(/\\/g, '/');
        }

        return function() {
            return gulp.src(config.globs.fonts.src)
                .pipe($.if(function(file) {
                    var fileBaseNormalized = convertWinToUnixSlashes(file.base);
                    // make sure to only flatten files from the bower_components directory

                    // first, build path section for frontend + bower_components folders 
                    var base = config.folders.basedir;
                    if( base.slice(-1) != '/' ) base += '/';

                    var bowerDir = preparePathForSubstringComparison(base + config.folders.bower); // deprecated, only for legacy reasons
                    var nodeDir  = preparePathForSubstringComparison(base + config.folders.node);

                    return fileBaseNormalized.indexOf(bowerDir) !== -1 || fileBaseNormalized.indexOf(nodeDir) !== -1;
                }, $.flatten()))
                .pipe(gulp.dest(config.assembleDest(config.globs.fonts.dest)));
        };
    },
    /*vendor: function(config) {
        return function() {
            // no linting here is intentional
            return gulp.src(config.globs.vendor.src)
                .pipe(lec({verbose:false, eolc: 'CRLF', encoding:'utf8'}))
                .pipe(gulp.dest(config.assembleDest(config.globs.vendor.dest)));
        };
    },
    vendorModified: function(config) {
        return function() {
            // no linting here is intentional
            return gulp.src(config.globs.vendorModified.src)
                .pipe($.plumber(plumberDefault))
                .pipe($.if(PRODUCTION, $.uglify().on('error', gutil.log)))
                .pipe(lec({verbose:false, eolc: 'CRLF', encoding:'utf8'}))
                .pipe(gulp.dest(config.assembleDest(config.globs.vendorModified.dest)));
        };
    },*/
    favicons: function(config) {
        return function() {
            return gulp.src(config.globs.favicons.src)
                .pipe(gulp.dest(config.assembleDest(config.globs.favicons.dest)));
        };
    },
    vendor: function(config) {
        return function() {
            return gulp.src(config.globs.vendor.src)
                .pipe(gulp.dest(config.assembleDest(config.globs.vendor.dest)));
        };
    },

    jsVendor: function(config) {
        return function() {
            if( typeof config.vendor_js_concatenation === 'undefined' || !isArray(config.vendor_js_concatenation) ) {
                return mergestream([]); // do nothing
            }

            // last entry is fallback, every entry before gets "string checked", if source file would be inside directory path
            var searchDirectories = [
                config.folders.basedir + '/' + config.folders.src   + '/scripts/vendor/',  // frontend vendor stuff
                config.folders.basedir + '/' + config.folders.node  + '/',                 // node modules vendor stuff
                config.folders.basedir + '/' + config.folders.bower + '/'                  // bower vendor stuff (deprecated)
            ];

            var concatStreams = config.vendor_js_concatenation.map(function(concatInstruction) {
                var destParsed = path.posix.parse(concatInstruction.output);

                //logObject(concatInstruction.files, 'concatInstruction.files', true);
                //gutil.log('save vendor_js_concatenation: ' + config.assembleDest(destParsed.dir) + ' / ' + destParsed.base);

                var files = concatInstruction.files.map(function(file) {
                    // search through the directories and find the first which contains the file currently looked at (dir path string comparison)
                    for(var i = 0; i < searchDirectories.length - 1; ++i) {
                        var path = (searchDirectories[i] + file).replace('//', '/');
                        if( fs.existsSync(path) ) {
                            return path;
                        }
                    }

                    // fallback, because no matching directory could be found
                    var lastSearchDirectory = searchDirectories[searchDirectories.length - 1];
                    return (lastSearchDirectory + file).replace('//', '/');
                });

                return gulp.src(files)
                    .pipe($.plumber(plumberDefault))
                    .pipe($.if(!PRODUCTION, $.sourcemaps.init()))
                    .pipe(PRODUCTION ? $.uglify()/*.on('error', gutil.log)*/ : gutil.noop())
                    .pipe($.change(function(content) {
                        // prepend a js comment containing the source filename to file content
                        var filename = this.file.path.substring(this.file.cwd.length + 1);

                        return '// ' + filename + "\n" + content;
                    }))
                    .pipe($.concat(destParsed.base).on('error', gutil.log))
                    .pipe($.if(!PRODUCTION, $.sourcemaps.write('./')))
                    .pipe(gulp.dest(config.assembleDest(destParsed.dir)));
            });

            return mergestream(concatStreams);
        };
    }
};


// perform the magic
createSupportTasks(buildTasks, targetDependencies);
