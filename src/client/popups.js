// Swal from CDN
export class Popups {
  static async custom (args) {
    return Swal.fire({
      icon: args.icon ?? '',
      title: args.title ?? '',
      text: args.message ?? '',
      timer: args.timer ?? null,
      showCloseButton: args.closeBtn ?? false,
      allowOutsideClick: args.outsideClick ?? false,
      allowEscapeKey: args.escape ?? false,
      showConfirmButton: args.confirm ?? false,
      showCancelButton: args.cancel ?? false,
      confirmButtonText: args.confirmText ?? 'Confirm',
      cancelButtonText: args.cancelText ?? 'Cancel',
    });
  }

  static async error (args) {
    return Popups.custom({
      icon: 'error',
      closeBtn: true,
      title: args.title ?? 'Oops',
      message: args.message,
      timer: args.timer ?? 10000,
    });
  }

  static async unrecoverable () {
    return Popups.custom({
      icon: 'error',
      title: 'Really bad error',
      message: `Please refresh or contact me :(`,
    });
  }

  static async cancelable (args) {
    return Popups.custom({
      cancel: true,
      title: args.title ?? 'Cancel',
      message: args.message,
      timer: args.timer,
    });
  }

  static async questionable (args) {
    return Popups.custom({
      icon: 'question',
      cancel: true,
      confirm: true,
      confirmText: 'Accept',
      cancelText: 'Reject',
      title: args.title,
      message: args.message,
      timer: args.timer,
    })
  }

  static async close () {
    return Swal.close();
  }
}
