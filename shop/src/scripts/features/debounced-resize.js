require(["jquery"], function ($) {
    // debounced-resize.js
    $(function ($) {
        var resizeTimeout = null;

        $(window).on("resize", function () {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(function () {
                $(window).trigger("debounced-resize");
            }, 300);
        });
    });
});
