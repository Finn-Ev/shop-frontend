require(["jquery", "matchHeight"], function ($) {
    $(() => {
        $(".product-name ").matchHeight();
        $(".sub-category").matchHeight();
    });
});
