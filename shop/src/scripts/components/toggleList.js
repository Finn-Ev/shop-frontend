require(["jquery"], function ($) {
    var md = window.matchMedia("(max-width: 767px)");

    $(".linklist-toggle").on("click", function () {
        if (md.matches) {
            $(this)
                .toggleClass("linklist-toggled")
                .next(".footer-category-body")
                .toggleClass("show-links");
        }
    });
});
