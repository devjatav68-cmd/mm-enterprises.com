(function () {
  const PRODUCT_FROM_PATH = {
    "black-tshirt.html": "black-tshirt",
    "blue-tshirt.html": "blue-tshirt",
    "sky-blue-tshirt.html": "sky-blue-tshirt",
    "lavender-tshirt.html": "lavender-tshirt"
  };

  function getProductId() {
    const fileName = window.location.pathname.split("/").pop();
    return PRODUCT_FROM_PATH[fileName] || "";
  }

  function getSelectedSize() {
    return document.querySelector(".size-btn.active")?.textContent.trim() || "M";
  }

  function getQuantity() {
    return Number(document.getElementById("quantityValue")?.textContent || 1);
  }

  function showBackendToast(message) {
    if (typeof window.showToast === "function") {
      window.showToast(message);
      return;
    }

    const existingToast = document.querySelector(".nav-toast, .toast");
    if (existingToast) {
      existingToast.textContent = message;
      existingToast.classList.add("show");
      window.setTimeout(() => existingToast.classList.remove("show"), 1800);
      return;
    }

    window.alert(message);
  }

  async function postJson(url, payload) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }

    return data;
  }

  function setupSearch() {
    const form = document.querySelector(".nav-search");
    const input = document.querySelector(".nav-search input");

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const query = input?.value.trim() || "";

      if (!query) {
        showBackendToast("Type a product name to search");
        return;
      }

      try {
        const data = await fetch(`/api/search?q=${encodeURIComponent(query)}`).then((res) => res.json());
        if (data.results?.length) {
          window.location.href = data.results[0].url;
          return;
        }
        showBackendToast("No matching product found");
      } catch {
        showBackendToast("Search is unavailable right now");
      }
    });
  }

  function setupProductPageButtons() {
    const productId = getProductId();
    const cartBtn = document.getElementById("cartBtn");
    const buyBtn = document.getElementById("buyBtn");

    cartBtn?.addEventListener("click", async () => {
      try {
        const data = await postJson("/api/cart", {
          productId,
          size: getSelectedSize(),
          quantity: getQuantity()
        });
        showBackendToast(`Added ${data.item.quantity} ${data.item.name}, size ${data.item.size}`);
      } catch (error) {
        showBackendToast(error.message);
      }
    });

    buyBtn?.addEventListener("click", async () => {
      try {
        const data = await postJson("/api/orders", {
          productId,
          size: getSelectedSize(),
          quantity: getQuantity()
        });
        showBackendToast(`Order ${data.order.id} saved. Total Rs. ${data.order.total}`);
      } catch (error) {
        showBackendToast(error.message);
      }
    });
  }

  function setupShopButtons() {
    document.querySelectorAll(".shop-card button").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const card = button.closest(".shop-card");
        const href = card?.getAttribute("href") || "";
        const productId = href.replace(/\.html$/i, "");

        try {
          const data = await postJson("/api/cart", {
            productId,
            size: "M",
            quantity: 1
          });
          showBackendToast(`Added ${data.item.name}`);
        } catch (error) {
          showBackendToast(error.message);
        }
      });
    });
  }

  setupSearch();
  setupProductPageButtons();
  setupShopButtons();
})();
