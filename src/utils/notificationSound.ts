const COMPLETION_SOUND_URL = 'https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/sons/beep.ogg';
const ERROR_SOUND_URL = 'https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/sons/error.ogg';
const MESSAGE_SEND_SOUND_URL = 'https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/sons/message-send.ogg';
const MESSAGE_RECEIVED_SOUND_URL = 'https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/sons/message-received.ogg';

export function playCompletionSound() {
  try {
    const audio = new Audio(COMPLETION_SOUND_URL);
    audio.volume = 0.5;

    audio.play().catch(() => {});
  } catch (error) {}
}

export function playErrorSound() {
  try {
    const audio = new Audio(ERROR_SOUND_URL);
    audio.volume = 0.6;

    audio.play().catch(() => {});
  } catch (error) {}
}

export function playMessageSendSound() {
  try {
    const audio = new Audio(MESSAGE_SEND_SOUND_URL);
    audio.volume = 0.5;

    audio.play().catch(() => {});
  } catch (error) {}
}

export function playMessageReceivedSound() {
  try {
    const audio = new Audio(MESSAGE_RECEIVED_SOUND_URL);
    audio.volume = 0.5;

    audio.play().catch(() => {});
  } catch (error) {}
}
