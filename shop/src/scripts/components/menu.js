require(["jquery", "mmenu"], function ($, mmenu) {
    jQuery(function ($) {
        //Mmenu.configs.offCanvas.page.selector = "#my-page";
        var mm = jQuery("#mobileMenu");

        mm.mmenu(
            {
                // options
                slidingSubmenus: false,
                extensions: [
                    "pagedim-black",
                    "position-left",
                    "border-none",
                    "position-front",
                    "shadow-menu",
                    "shadow-panels",
                    //"fullscreen"
                ],
                iconPanels: false,
                navbar: {
                    title:
                        "<img class='navbar-title' src='images/desktop/bugatti-logo.svg' />",
                },
                navbars: [
                    {
                        position: "top",
                        content: "<i class='fas fa-times navbar-close'></i>",
                    },
                ],
            },
            {
                // configuration

                offCanvas: {
                    pageSelector: "#js-mmenu-wrapper",
                },
                classNames: {
                    fixedElements: {
                        //fixed: "fix",
                        //sticky: "sticky-top"
                    },
                },
            }
        );
        mobileMenu.data = jQuery("#mobileMenu").data("mmenu");

        $(document).on("click", ".mobile-menu-toggle", function () {
            mobileMenu.data.open();
        });

        $(document).on("click", ".navbar-close ", function () {
            mobileMenu.data.close();
        });
    });
});
