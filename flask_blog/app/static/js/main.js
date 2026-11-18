// Client-side enhancements for delete confirmation & flash message dismissal
document.addEventListener("DOMContentLoaded", () => {
  // Confirm destructive delete forms
  document.querySelectorAll("form[data-confirm]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      const msg = form.getAttribute("data-confirm") || "Are you sure?";
      if (!window.confirm(msg)) {
        event.preventDefault();
      }
    });
  });

  // Auto-dismiss transient Bootstrap alerts after 5 seconds
  document.querySelectorAll(".alert-dismissible").forEach((alertEl) => {
    setTimeout(() => {
      if (window.bootstrap && window.bootstrap.Alert) {
        const bsAlert = window.bootstrap.Alert.getOrCreateInstance(alertEl);
        bsAlert.close();
      }
    }, 5000);
  });
});
