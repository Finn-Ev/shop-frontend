var config = {
    paths: {
        // assuming that knockout lives in the node_modules/knockout/knockout.js file
        // if not, you have to specify relative to `node_modules` path
        // without .js extension
        menuAim: "vendor/jQuery-menu-aim/jquery.menu-aim",
        swiper: "vendor/swiper/js/swiper",
        "vanilla-lazyload": "vendor/vanilla-lazyload/dist/lazyload.amd",
        bootstrap: "vendor/bootstrap/dist/js/bootstrap.bundle",
        popper: "vendor/popper.js/dist/umd/popper",
        mmenu: "vendor/jquery.mmenu/dist/jquery.mmenu.all",
        headroom: "vendor/headroom.js/dist/headroom",
        lazyload: "vendor/vanilla-lazyload/dist/lazyload.amd",
    },
    shim: {
        menuAim: {
            deps: ["jquery"],
        },
        mmenu: {
            deps: ["jquery"],
            exports: "mmenu",
        },
    },
};
