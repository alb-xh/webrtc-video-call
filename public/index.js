const socket = io('http://localhost:3000');

socket.on("connect", () => {
  el("call_id").textContent = `Your call id: ${socket.id}`;
});

const ring = new Audio('./ring.mp3');
ring.onended = () => { ring.play(); };
ring.onpause = () => { ring.currentTime = 0; };

const el = (id) => document.getElementById(id);

el("call_input").onfocus = (e) => {
  el('call_input').style.borderColor = '';
}

el("call_button").onclick = () => {
  const input = el('call_input');
  const callId = input.value ?? '';

  if (callId.length !== 20) {
    input.style.borderColor = 'red';
    return;
  }

  ring.play();

  Swal.fire({
    title: `Calling...`,
    showConfirmButton: false,
    showCancelButton: true,
    allowOutsideClick: false,
    allowEscapeKey: false,
    timer: 30000,
  }).then(() => {
    ring.pause();
  });
};
