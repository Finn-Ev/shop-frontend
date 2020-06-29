require(["jquery"], function ($) {
    // scroll-to-top
    $(function ($) {
        $(".js_scroll-to-top").on("click", function (e) {
            e.preventDefault();
            $("html, body").animate(
                {
                    scrollTop: 0,
                },
                300
            );
        });
    });
});
