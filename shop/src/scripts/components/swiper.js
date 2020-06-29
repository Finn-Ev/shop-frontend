require(["jquery", "swiper"], function ($, Swiper) {
    jQuery(function ($) {
        var swiper = new Swiper(".swiper-container", {
            slidesPerView: 2,
            breakpoints: {
                // when window width is >= 320px
                320: {
                    slidesPerView: 2,
                    spaceBetween: 20,
                },
                // when window width is >= 480px
                768: {
                    slidesPerView: 3,
                    spaceBetween: 30,
                },
            },
            navigation: {
                nextEl: ".swiper-button-next",
                prevEl: ".swiper-button-prev",
            },
        });
    });
});
