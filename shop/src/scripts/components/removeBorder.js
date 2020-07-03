const subCategoriesContainer = document.querySelector(".sub-categories");

const subCategoriesContents = Object.values(
    subCategoriesContainer.children[0].childNodes
);

const subCategories = subCategoriesContents.filter(
    (child) => child.nodeName === "DIV"
);
