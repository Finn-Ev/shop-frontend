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
            direction: "horizontal",
            slidesPerView: "3",
            spaceBetween: 10,
            watchSlidesVisibility: true,
            watchSlidesProgress: true,
            navigation: {
                nextEl: ".side-swiper-control-next",
                prevEl: ".side-swiper-control-prev",
            },
            breakpoints: {
                576: {
                    direction: "vertical",
                    slidesPerView: "4",
                },
                768: {
                    direction: "horizontal",
                    slidesPerView: "3",
                },
                992: {
                    direction: "vertical",
                    slidesPerView: "4",
                },
            },
        });

        var productDetailsMainSwiper = new Swiper(".main-swiper", {
            slidesPerView: 1,
            navigation: {
                nextEl: ".main-swiper-control-next",
                prevEl: ".main-swiper-control-prev",
            },
            thumbs: {
                swiper: productDetailsSideSwiper,
            },
        });
    });
});
