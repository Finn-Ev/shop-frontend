require(["jquery", "leonex_fancybox"], function ($, Fancybox) {
    $('[data-fancybox="preview"]').fancybox({
        thumbs: {
            autoStart: true,
        },
    });
});
