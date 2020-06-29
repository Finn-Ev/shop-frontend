window.lazyLoadOptions = {
    throttle: 0,
    skip_invisible: true,
    threshold: 0,
    elements_selector: '[data-src],[data-bg],[data-srcset]'
};
window.addEventListener('LazyLoad::Initialized', function (e) {
    window.lazyLoad = e.detail.instance;
}, false);
