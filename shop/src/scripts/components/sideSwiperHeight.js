const sideSwiper = document.querySelector(".side-swiper");
const mainSwiperImage = document.querySelector(".main-swiper-image");

const adjustHeight = () => {
    const lg = window.matchMedia("(min-width: 1100px)");

    const smTillMd = window.matchMedia(
        "(min-width: 576px) and (max-width: 768px)"
    );

    if (lg.matches || smTillMd.matches)
        return (sideSwiper.style.height = mainSwiperImage.height + "px");

    sideSwiper.style.height = null;
};

if (sideSwiper) {
    adjustHeight();
    window.onresize = adjustHeight;
}
