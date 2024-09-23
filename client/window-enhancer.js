export class WindowEnhancer {
  static enhance (window) {
    window.addEventListener('error', async (err) => {
      console.error(err);
      await Popups.unrecoverable();
    });

    window.document.getElementByIdOrThrow = function (id) {
      const element = this.getElementById(id);
      if (!element) {
        throw new Error(`Element "${id}" wasn't found`);
      }

      return element;
    }

    window.document.appendClassName = function (element, className) {
      element.className = (element.className ?? '').split(' ')
        .filter(Boolean)
        .concat(className)
        .join(' ');

      return element;
    }

    window.document.removeClassName = function (element, className) {
      element.className = (element.className ?? '').split(' ')
        .filter((name) => name !== className)
        .join(' ');

      return element;
    }

    return window;
  }
}
