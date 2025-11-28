const COMPLETION_SOUND_URL = 'https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/sons/beep.ogg';
const ERROR_SOUND_URL = 'https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/sons/error.ogg';
const MESSAGE_SEND_SOUND_URL = 'https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/sons/message-send.ogg';
const MESSAGE_RECEIVED_SOUND_URL = 'https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/sons/message-received.ogg';

export function playCompletionSound() {
  try {
    const audio = new Audio(COMPLETION_SOUND_URL);
    audio.volume = 0.5;

    audio.play().then(() => {
      console.log('🔔 Som de conclusão tocado!');
    }).catch(error => {
      console.warn('Não foi possível tocar o som:', error);
    });
  } catch (error) {
    console.warn('Erro ao criar áudio:', error);
  }
}

export function playErrorSound() {
  try {
    const audio = new Audio(ERROR_SOUND_URL);
    audio.volume = 0.6;

    audio.play().then(() => {
      console.log('🔴 Som de erro tocado!');
    }).catch(error => {
      console.warn('Não foi possível tocar o som de erro:', error);
    });
  } catch (error) {
    console.warn('Erro ao criar áudio de erro:', error);
  }
}

export function playMessageSendSound() {
  try {
    const audio = new Audio(MESSAGE_SEND_SOUND_URL);
    audio.volume = 0.5;

    audio.play().then(() => {
      console.log('📤 Som de envio de mensagem tocado!');
    }).catch(error => {
      console.warn('Não foi possível tocar o som de envio:', error);
    });
  } catch (error) {
    console.warn('Erro ao criar áudio de envio:', error);
  }
}

export function playMessageReceivedSound() {
  try {
    const audio = new Audio(MESSAGE_RECEIVED_SOUND_URL);
    audio.volume = 0.5;

    audio.play().then(() => {
      console.log('📥 Som de recebimento de mensagem tocado!');
    }).catch(error => {
      console.warn('Não foi possível tocar o som de recebimento:', error);
    });
  } catch (error) {
    console.warn('Erro ao criar áudio de recebimento:', error);
  }
}
