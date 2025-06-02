const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const sharp = require('sharp');
const path = require('path');
const math = require('mathjs');
const axios = require('axios');
const translate = require('google-translate-api-x');
const indicesPorChat = {};
 

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Para que el bot procese sus propios mensajes y los trate como nuevos mensajes entrantes
client.on('message_create', async msg => {
    if (msg.fromMe) {
        client.emit('message', msg);
    }
});

client.on('ready', () => {
    console.log('✅ Bot listo y conectado.');
});

client.on('message', async message => {
    const chat = await message.getChat();
    const sender = message.from;
    const isGroup = chat.isGroup;
    const fromMe = message.fromMe;

    const texto = message.body.toLowerCase().trim();
    console.log('📩 Mensaje recibido:', texto);


    if (texto.startsWith('!fotopp')) {
    try {
        let contacto;

        // Si mencionó a alguien, usar ese contacto
        if (message.mentionedIds && message.mentionedIds.length > 0) {
            contacto = await client.getContactById(message.mentionedIds[0]);
        } 
        // Si escribió un número después del comando, tratar de obtener contacto
        else {
            const partes = texto.split(' ');
            if (partes.length > 1) {
                const posibleNumero = partes[1].replace(/\D/g, ''); // solo números
                if (posibleNumero.length > 5) { // validar longitud mínima
                    const id = `${posibleNumero}@c.us`;
                    try {
                        contacto = await client.getContactById(id);
                    } catch {
                        // no existe contacto
                    }
                }
            }
        }

        // Si no hay contacto mencionado ni número, usar el mismo que mandó el mensaje
        if (!contacto) {
            contacto = await message.getContact();
        }

        const url = await contacto.getProfilePicUrl();

        if (!url) {
            await message.reply('❌ No tiene foto de perfil visible.');
            return;
        }

        // Descargar y enviar imagen (igual que antes)
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data, 'binary');
        const media = new MessageMedia('image/jpeg', buffer.toString('base64'), 'perfil.jpg');
        await message.reply(media, null, { caption: `📷 Foto de perfil de ${contacto.pushname || contacto.number}` });
        
    } catch (error) {
        console.error('💥 Error al obtener o enviar la foto:', error);
        await message.reply('⚠️ Error al obtener o enviar la foto.');
    }
}




    let isAdmin = false;
    if (isGroup) {
        const participant = chat.participants.find(p => p.id._serialized === sender);
        isAdmin = participant ? participant.isAdmin : false;
    }

    // Función para responder y mostrar en consola
    async function responder(textoRespuesta) {
        await message.reply(textoRespuesta);
        console.log(`💬 Bot respondió a ${message.from} (fromMe=${message.fromMe}): ${textoRespuesta}`);
    }

    // Ahora el bot procesa sus propios mensajes
    if (fromMe) {
        if (texto === '!hola') {
            await responder('¡Hola! Esto es una respuesta para ti (mensaje propio).');
        }
        // Puedes agregar más respuestas automáticas para mensajes propios aquí
        // No retornamos para que el bot siga procesando los comandos normalmente
    }

    // Comando !promote para promover a admin
    if (texto.startsWith('!promote')) {
        if (!isGroup) {
            await responder('Este comando solo funciona en grupos.');
            return;
        }
        if (!isAdmin) {
            await responder('Solo los administradores pueden usar este comando.');
            return;
        }

        const mention = message.mentionedIds && message.mentionedIds[0];
        if (!mention) {
            await responder('Por favor menciona a un usuario para promover con !promote @usuario');
            return;
        }

        try {
            await chat.promoteParticipants([mention]);
            await responder('Usuario promovido a administrador correctamente.');
        } catch (error) {
            console.log('Error al promover usuario:', error);
            await responder('No pude promover al usuario. ¿Tengo permisos de administrador?');
        }
        return;
    }

        

    if (texto === '!aimg') {
        try {
            let media;

            if (message.hasQuotedMsg) {
                const quoted = await message.getQuotedMessage();
                if (quoted && quoted.type === 'sticker') {
                    media = await quoted.downloadMedia();
                } else {
                    await responder('Debes responder a un sticker para convertirlo en imagen.');
                    return;
                }
            } else if (message.type === 'sticker') {
                media = await message.downloadMedia();
            } else {
                await responder('Envía o responde a un sticker para convertirlo en imagen.');
                return;
            }

            const buffer = Buffer.from(media.data, 'base64');
            const outputPath = path.join(__dirname, 'sticker_convertido.jpg');

            await sharp(buffer)
                .jpeg()
                .toFile(outputPath);

            const imageBuffer = fs.readFileSync(outputPath);
            const imageBase64 = imageBuffer.toString('base64');
            const imageMedia = new MessageMedia('image/jpeg', imageBase64, 'sticker.jpg');

            await message.reply(imageMedia, null, { caption: '🖼️ Aquí tienes tu sticker convertido a imagen.' });

            fs.unlinkSync(outputPath);
            console.log('✅ Sticker convertido en imagen y enviado.');
        } catch (error) {
            console.error('❌ Error al convertir sticker a imagen:', error);
            await responder('Ocurrió un error al convertir el sticker.');
        }
        return;
    }


    // Comando !menu
    if (texto === '!menu') {
        let saludo;
 
       



        if (isGroup) {
            saludo = `👥 *Grupo detectado: ${chat.name || 'grupo sin nombre'}*`;
        } else {
            const contacto = await message.getContact();
            saludo = `👤 *Chat privado contigo, ${contacto.pushname || contacto.number}*`;
        }

        await responder(
`🤖 *Hola, soy Stem*  
Tu asistente inteligente de WhatsApp.  
Versión: *v1.0.0*  
${saludo}

🛠 *Menú de Comandos Disponibles*:

 👥 Comandos para Grupos:
1️⃣ @todos — Etiquetar a todos
3️⃣ !cerrar — Solo admins pueden enviar mensajes
4️⃣ !abrir — Permitir que todos envíen mensajes
5️⃣ !echar @usuario — Expulsar usuario (admins)
6️⃣ !borrar — Borrar mensaje respondido (admins)
🕵🏻‍♂️ !descripcion — Cambiar descripción del grupo

🔹 🧰 Utilidades:
🔟 !hora — Ver la hora actual
🔢 !fecha — Ver la fecha actual
🧮 !calcular [operación] — Calculadora
📷 !fotopp - revelar la foto de perfil de alguien
🚜 !traducir [código_idioma] texto - Traduce el texto al idioma indicado.
  Ejemplo: !traducir en hola mundo

Extras: Códigos de idioma comunes
en = Inglés

es = Español

fr = Francés

de = Alemán

it = Italiano

pt = Portugués

ru = Ruso

zh = Chino


🔹 🎨 Multimedia:
2️⃣ !sticker — Crear sticker
🖼️ !meme — Enviar meme aleatorio
🔄 !aimg — Convierte un sticker a imagen
🐱‍👤 !plantillas - plantillas de memes
🏀 !goat - goat indiscutible


🔹 🎉 Diversión:
9️⃣ !chiste — Chiste aleatorio
💬 !frase — Frase motivacional
✊✋✌ !ppt (elije uno) - piedra papel o tijera
⁉ !adivina - adivinar un numero con !n

(PROXIMAMENTE: UN BOT DE UNICAMENTE ECONOMÍA 🏦💰💲🤑💵💴💹💱💶💷👛💸)

🔹 📋 Misceláneo:
7️⃣ !menu — Mostrar el menú
8️⃣ !hola — Saludo
🏓 !ping — Pong`
        );
        return;
    }

    if (texto === '!code') {
        const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();
        if (!global.codes) global.codes = {};
        global.codes[message.from] = codigo;
        await responder(`Tu código de registro es: *${codigo}*`);
        return;
    }

    if (texto === '@todos' && isGroup) {
        try {
            const mentions = chat.participants.map(p => p.id._serialized);
            await message.reply('¡Atención a todos! 👋', null, { mentions });
            console.log(`💬 Bot etiquetó a todos en ${message.from}`);
        } catch (error) {
            console.log('Error al etiquetar a todos:', error);
            await responder('No pude etiquetar a todos.');
        }
        return;
    }

    if (texto === '!sticker') {
        try {
            let media;

            if (message.hasMedia) {
                media = await message.downloadMedia();
            } else if (message.hasQuotedMsg) {
                const quotedMsg = await message.getQuotedMessage();
                if (quotedMsg.hasMedia) {
                    media = await quotedMsg.downloadMedia();
                }
            }

            if (!media) {
                await responder('Por favor, envía o responde a una imagen para crear el sticker.');
                return;
            }

            const buffer = Buffer.from(media.data, 'base64');
            const outputPath = path.join(__dirname, 'temp.webp');

            await sharp(buffer)
                .resize(512, 512, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .webp()
                .toFile(outputPath);

            const webpBase64 = fs.readFileSync(outputPath, { encoding: 'base64' });
            const stickerMedia = new MessageMedia('image/webp', webpBase64, 'sticker.webp');

            await message.reply(stickerMedia, null, { sendMediaAsSticker: true });

            fs.unlinkSync(outputPath);

            console.log('✅ Sticker enviado correctamente');
        } catch (error) {
            console.log('❌ Error al crear sticker:', error);
            await responder('Ocurrió un error al crear el sticker.');
        }
        return;
    }




    if (texto === '!close' || texto === '!cerrar') {
        if (!isAdmin) {
            await responder('Solo administradores pueden usar este comando.');
            return;
        }
        if (!isGroup) {
            await responder('Este comando solo funciona en grupos.');
            return;
        }
        try {
            await chat.setMessagesAdminsOnly(true);
            await responder('El grupo está cerrado: solo los administradores pueden enviar mensajes.');
        } catch (error) {
            await responder('No pude cambiar la configuración. ¿Tengo permisos de administrador?');
        }
        return;
    }

    if (texto === '!open' || texto === '!abrir') {
        if (!isAdmin) {
            await responder('Solo administradores pueden usar este comando.');
            return;
        }
        if (!isGroup) {
            await responder('Este comando solo funciona en grupos.');
            return;
        }
        try {
            await chat.setMessagesAdminsOnly(false);
            await responder('El grupo está abierto: todos pueden enviar mensajes.');
        } catch (error) {
            await responder('No pude cambiar la configuración. ¿Tengo permisos de administrador?');
        }
        return;
    }

    if (texto.startsWith('!echar')) {
        if (!isAdmin) {
            await responder('Solo administradores pueden usar este comando.');
            return;
        }
        const mention = message.mentionedIds && message.mentionedIds[0];
        if (!mention) {
            await responder('Menciona a un usuario para expulsar con !echar @usuario');
            return;
        }
        try {
            await chat.removeParticipants([mention]);
            await responder('Usuario expulsado.');
        } catch (err) {
            await responder('No pude expulsar al usuario. ¿Tengo permisos suficientes?');
        }
        return;
    }

    if (texto === '!borrar') {
        if (!isAdmin) {
            await responder('Solo administradores pueden usar este comando.');
            return;
        }
        if (!message.hasQuotedMsg) {
            await responder('Responde al mensaje que quieres borrar con !borrar.');
            return;
        }
        try {
            let quotedMsg;
            try {
                quotedMsg = await message.getQuotedMessage();
            } catch {
                quotedMsg = null;
            }
            if (!quotedMsg) {
                await responder('No pude obtener el mensaje citado. Puede que haya sido eliminado o no esté disponible.');
                return;
            }
            await quotedMsg.delete(true);
            await responder('Mensaje borrado.');
        } catch (error) {
            console.log('Error al borrar mensaje:', error);
            await responder('No pude borrar el mensaje. Puede que el mensaje citado ya no exista o no tenga permisos.');
        }
        return;
    }

    if (texto === '!hola') {
        await responder('¡Hola! ¿En qué puedo ayudarte?');
        return;
    }

    if (texto === '!chiste') {
        const chistes = [
            "¿Por qué el libro de matemáticas estaba triste? Porque tenía muchos problemas.",
            "¿Qué le dice una iguana a su hermana gemela? ¡Iguanitas!",
            "¿Cómo organizan las fiestas los átomos? En grupos."
        ];
        const chiste = chistes[Math.floor(Math.random() * chistes.length)];
        await responder(chiste);
        return;
    }

    if (texto === '!hora') {
        const hora = new Date().toLocaleTimeString();
        await responder(`La hora actual es ${hora}`);
        return;
    }

    if (texto === '!fecha') {
        const fecha = new Date().toLocaleDateString();
        await responder(`La fecha actual es ${fecha}`);
        return;
    }

        if (texto === '!meme') {
        try {
            const res = await axios.get('https://meme-api.com/gimme');
            const memeUrl = res.data.url;
            const memeBuffer = await axios.get(memeUrl, { responseType: 'arraybuffer' });

            const media = new MessageMedia('image/jpeg', Buffer.from(memeBuffer.data, 'binary').toString('base64'), 'meme.jpg');
            await message.reply(media, null, { caption: `🤣 Meme aleatorio de: ${res.data.subreddit}` });
            console.log('✅ Meme enviado correctamente');
        } catch (error) {
            console.error('❌ Error al obtener o enviar meme:', error);
            await responder('Ocurrió un error al obtener un meme. Intenta de nuevo más tarde.');
        }
        return;
    }


    if (texto === '!frase') {
        const frases = [
            "El éxito es la suma de pequeños esfuerzos.",
            "No sueñes tu vida, vive tu sueño.",
            "Haz lo que amas y no trabajarás un solo día."
        ];
        const frase = frases[Math.floor(Math.random() * frases.length)];
        await responder(frase);
        return;
    }

    if (texto === '!ping') {
        await responder('Pong 🏓');
        return;
    }


    if (texto.startsWith('!calcular ')) {
        const operacion = texto.slice(10);
        try {
            const resultado = math.evaluate(operacion);
            await responder(`Resultado: ${resultado}`);
        } catch {
            await responder('Operación inválida.');
        }
        return;
    }



    if (texto.startsWith('!descripcion') && isGroup && isAdmin) {
        const nuevaDescripcion = texto.slice(13).trim(); // Extrae el texto después de !descripcion
    if (!nuevaDescripcion) {
        await mensaje.reply('❗ Escribe la nueva descripción. Ejemplo:\n!descripcion Este es un nuevo grupo');
        return;
    }

    try {
        await chat.setDescription(nuevaDescripcion);
        await mensaje.reply('✅ Descripción del grupo actualizada correctamente.');
    } catch (error) {
        console.error('Error al cambiar la descripción:', error);
        await mensaje.reply('❌ No se pudo cambiar la descripción del grupo.');
    }
}


    if (texto.startsWith('!traducir ')) {
    const partes = texto.split(' ');
    if (partes.length < 3) {
        await message.reply('❗ Usa el comando así: !traducir [código_idioma] texto a traducir\nEjemplo: !traducir en hola mundo');
        return;
    }
    const targetLang = partes[1];
    const textoATraducir = partes.slice(2).join(' ');

    try {
        const res = await translate(textoATraducir, { to: targetLang });
        await message.reply(`🔤 Traducción (${targetLang}): ${res.text}`);
    } catch (error) {
        console.error('Error en traducción:', error);
        await message.reply('❌ Error al traducir el texto.');
    }
    return;
}

if (texto === '!plantillas') {
    try {
        const plantillas = [
            { nombre: 'Meme 1', url: 'https://i.pinimg.com/originals/90/3c/b7/903cb774a25208856d17783d258dcaab.jpg' },
            { nombre: 'Simpsons Meme', url: 'https://www.mundocuentas.com/wp-content/uploads/2021/09/los-simpsons-meme-11-756x600.jpg' },
            { nombre: 'Meme 3', url: 'https://i.pinimg.com/474x/43/39/ef/4339efc95b7cd815c323ddcb0c21d47e.jpg' },
            { nombre: 'Meme 4', url: 'https://th.bing.com/th/id/OIP.j52g2pNAXR4IVtZ0MW5drQHaHN?w=193&h=188&c=7&r=0&o=5&pid=1.7' },
            { nombre: 'Meme 5', url: 'https://th.bing.com/th/id/OIP.PzYmJTg9pVnl-lUak1VckAHaKY?w=138&h=193&c=7&r=0&o=5&pid=1.7' },
            { nombre: 'Meme 6', url: 'https://th.bing.com/th/id/OIP.v-gYw0KNkuhoe9YHVUeD_wHaGx?w=211&h=193&c=7&r=0&o=5&pid=1.7' }
        ];

        const chat = await message.getChat();
        const chatId = chat.id._serialized;

        // Si no hay índice guardado para ese chat, inicializarlo en 0
        if (!(chatId in indicesPorChat)) {
            indicesPorChat[chatId] = 0;
        }

        // Obtener plantilla actual para el chat
        const indice = indicesPorChat[chatId];
        const plantilla = plantillas[indice];

        const response = await axios.get(plantilla.url, { responseType: 'arraybuffer' });
        const media = new MessageMedia('image/jpeg', Buffer.from(response.data).toString('base64'), `${plantilla.nombre}.jpg`);

        await client.sendMessage(chatId, media, {
            caption: `🖼️ Plantilla: ${plantilla.nombre}`
        });

        // Avanzar índice y ciclar si se pasa del final
        indicesPorChat[chatId] = (indice + 1) % plantillas.length;

        console.log('✅ Plantilla enviada correctamente.');
    } catch (error) {
        console.error('❌ Error al enviar plantilla:', error);
        await responder('Ocurrió un error al enviar la plantilla.');
    }
    return;
}

if (message.body.startsWith('!ppt')) {
    const opciones = ['piedra', 'papel', 'tijera'];
    const eleccionBot = opciones[Math.floor(Math.random() * 3)];
    const eleccionUsuario = message.body.slice(5).toLowerCase();

    if (!opciones.includes(eleccionUsuario)) {
        message.reply('Debes escribir: `!ppt piedra`, `!ppt papel` o `!ppt tijera`.');
    } else {
        let resultado = '';
        if (eleccionUsuario === eleccionBot) {
            resultado = '¡Empate! 😐';
        } else if (
            (eleccionUsuario === 'piedra' && eleccionBot === 'tijera') ||
            (eleccionUsuario === 'papel' && eleccionBot === 'piedra') ||
            (eleccionUsuario === 'tijera' && eleccionBot === 'papel')
        ) {
            resultado = '¡Ganaste! 😎';
        } else {
            resultado = 'Perdiste... 😢';
        }
        message.reply(`Tú: *${eleccionUsuario}*\nBot: *${eleccionBot}*\n\n${resultado}`);
    }
}

if (message.body === '!adivina') {
    const numero = Math.floor(Math.random() * 10) + 1;
    message.reply(`Estoy pensando en un número del 1 al 10...\n¡Escribe: *!n [tu número]* para intentar adivinarlo!\n(Ejemplo: *!n 4*)`);

    // Guardamos el número en una variable global temporal
    global.numeroSecreto = numero;
}

if (message.body.startsWith('!n ')) {
    const intento = parseInt(message.body.slice(3));
    if (!global.numeroSecreto) return message.reply('Primero escribe `!adivina` para iniciar el juego.');
    if (intento === global.numeroSecreto) {
        message.reply('🎉 ¡Correcto! Adivinaste el número.');
        global.numeroSecreto = null;
    } else {
        message.reply('❌ Incorrecto. Intenta de nuevo.');
    }
}








   

    // Aquí puedes agregar más comandos o lógica

});

client.initialize();