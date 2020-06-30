require(["jquery", "swiper"], function ($, Swiper) {
    jQuery(function ($) {
        var productPageSwiper = new Swiper(".swiper-container", {
            slidesPerView: 2,
            breakpoints: {
                320: {
                    slidesPerView: 2,
                    spaceBetween: 10,
                },
                568: {
                    slidesPerView: 3,
                    spaceBetween: 20,
                },
                768: {
                    slidesPerView: 4,
                    spaceBetween: 30,
                },
            },
            navigation: {
                nextEl: ".swiper-button-next",
                prevEl: ".swiper-button-prev",
            },
        });

        var productDetailsSideSwiper = new Swiper(".side-swiper", {
            direction: "vertical",
            slidesPerView: 1,
            navigation: {
                nextEl: ".swiper-button-next",
                prevEl: ".swiper-button-prev",
            },
        });

        var productDetailsMainSwiper = new Swiper(".main-swiper", {
            slidesPerView: 1,
            navigation: {
                nextEl: ".swiper-button-next",
                prevEl: ".swiper-button-prev",
            },
        });
        productDetailsSideSwiper.params.control =
            productDetailsMainSwiper.params.control;
        productDetailsMainSwiper.params.control =
            productDetailsSideSwiper.params.control;
    });
});
