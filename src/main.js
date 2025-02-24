const TelegramBot = require("node-telegram-bot-api");
const sqlite3 = require("sqlite3").verbose();

const debug = true;
console.dlog = (msg, time) => {
    time || (time = Date.now());
    let date = new Date(time * 1000);
    let timestr = `${date.getFullYear()}/${date.getMonth()}/${date.getDate()} ${date.getHours()}.${date.getMinutes()}.${date.getSeconds()}`;
    if (debug) console.log(`[${timestr}]: ${msg}`);
};

const token = "";
const bot = new TelegramBot(token, { polling: true });

const SPECIAL_GROUP_ID = -6;
const SPECIAL_CHANNEL_ID = -0;
const SPECIAL_CHANNEL_LINK_ID = "";

dbm = (() => {
    let db;
    let dbm = {};
    dbm.initDB = async () => {
        // Подключаемся к базе данных (если база данных не существует, она будет создана)
        db = new sqlite3.Database("./database.db", (err) => {
            if (err) {
                console.error("DataBase connect error! ", err.message);
            } else {
                console.log("DataBase connect!");
            }
        });
        let result = true;
        await db.serialize(() => {
            // обработчик ошибок
            let erra = (err) => {
                if (err) console.log("db command error: ", err.message);
                result = false;
            };

            // Создаем таблицу users
            console.dlog("CREATE TABLE users");
            db.run(`CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY,
                first_name TEXT,
                last_name TEXT,
                username TEXT
            )`, erra);

            // Создаем таблицу banned_users
            console.dlog("CREATE TABLE banned_users");
            db.run(`CREATE TABLE IF NOT EXISTS banned_users (
                user_id INTEGER PRIMARY KEY,
                reason TEXT
            )`, erra);

            // Создаем таблицу messages
            console.dlog("CREATE TABLE messages");
            db.run(`CREATE TABLE IF NOT EXISTS messages (
                message_internal_id STRING PRIMARY KEY,
                message_group_id INTEGER,
                message_channel_id INTEGER,
                result TEXT,
                user_id INTEGER,
                date INTEGER
            )`, erra);

            // Создаем таблицу answers
            console.dlog("CREATE TABLE answers");
            db.run(`CREATE TABLE IF NOT EXISTS answers (
                message_group_id INTEGER,
                answer_group_id INTEGER
            )`, erra);
        });
        return result;
    };

    dbm.saveUserData = async (dbUser) => {
        console.dlog(`save user ${dbUser.user_id}(@${dbUser.username}) data!`);
        let req = db.prepare(`INSERT OR REPLACE INTO users (user_id, first_name, last_name, username) VALUES (?, ?, ?, ?)`,);
        return void await req.run(dbUser.user_id, dbUser.first_name, dbUser.last_name, dbUser.username);
    };
    dbm.getUserData = async (user_id) => {
        return await new Promise(function (resolve, reject) {
            db.get("SELECT * FROM users WHERE user_id = ?", [user_id], (err, row) => {
                if (err) reject(err);
                else if (row) resolve(row);
                else resolve(null);
            });
        });
    };

    dbm.banUser = async (user_id, reason) => {
        let req = db.prepare(`INSERT OR REPLACE INTO banned_users (user_id, reason) VALUES (?, ?)`,);
        return void await req.run(user_id, reason);
    };
    dbm.unbanUser = async (user_id) => {
        let req = db.prepare(`DELETE FROM banned_users WHERE user_id = ?`);
        return void await req.run(user_id);
    };
    dbm.getBannedUserData = async (user_id) => {
        return await new Promise(function (resolve, reject) {
            db.get("SELECT * FROM banned_users WHERE user_id = ?", [user_id], (err, row) => {
                    if (err) reject(err);
                    else if (row) resolve(row);
                    else resolve(null);
                },
            );
        });
    };
    dbm.userIsBanned = async (user_id) => {
        return await dbm.getBannedUserData(user_id) !== null;
    };
    dbm.getBannedUsers = async () => {
        return await new Promise(function (resolve, reject) {
            db.all("SELECT * FROM banned_users", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    };

    dbm.regMessage = async (message_internal_id, message_group_id = 0, message_channel_id = 0, result = "", user_id = 0, date = 0) => {
        let req = db.prepare(`INSERT OR REPLACE INTO messages (
            message_internal_id,
            message_group_id,
            message_channel_id,
            result,
            user_id,
            date
        ) VALUES (?, ?, ?, ?, ?, ?)`);
        return void await req.run(message_internal_id, message_group_id, message_channel_id, result, user_id, date);
    };
    dbm.replaceMessage = async (message_internal_id, message_group_id = 0, message_channel_id = 0, result = "", user_id = 0, date = 0) => {
        let req = db.prepare(`UPDATE messages SET
            message_group_id = ?,
            message_channel_id = ?,
            result = ?,
            user_id = ?,
            date = ?
            WHERE message_internal_id = ?
        `);
        return void await req.run(message_group_id, message_channel_id, result, user_id, date, message_internal_id);
    }
    dbm.getMessagesBy = async (argument, argumentName) => {
        return await new Promise(function (resolve, reject) {
            db.all(`SELECT * FROM messages WHERE ${argumentName} = ?`, [argument], (err, rows) => {
                    if (err) reject(err);
                    else if (rows) resolve(rows);
                    else resolve(null);
                },
            );
        });
    }
    dbm.getMessageBy = async (argument, argumentName) => {
        return await new Promise(function (resolve, reject) {
            db.get(`SELECT * FROM messages WHERE ${argumentName} = ?`, [argument], (err, row) => {
                    if (err) reject(err);
                    else if (row) resolve(row);
                    else resolve(null);
                },
            );
        });
    }
    dbm.getMessage = async (message_internal_id) => {
        return await dbm.getMessageBy(message_internal_id, "message_internal_id");
    };
    dbm.getMessages = async () => {
        return await new Promise(function (resolve, reject) {
            db.all("SELECT * FROM messages", [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows); 
                },
            );
        });
    };
    dbm.getMessagesByUserId = async (user_id) => {
        return await dbm.getMessagesBy(user_id, "user_id");
    };

    return dbm;
})();

function initBotActions() {
    function genAction(a){
        let b = a;
        return (...args) => {
            try {
                b(...args);
            }
            catch (e){
                console.error(e);
            }
        }
    }
    bot.on("message", genAction(msg => {
        const chatId = msg.chat.id;
        dbm.getMessageBy(`${chatId}:${msg.message_id}`, "message_internal_id").then(msgData => {
            if (msgData !== null) console.dlog("message is already back");
        })
        const text = msg.text;
        if (chatId !== SPECIAL_GROUP_ID) {
            regUserOnMessage(msg.from);
        }
        if (text !== undefined && text.startsWith("/")) {
            console.dlog(`new command by ${chatId}`, msg.date);
            onCommand(msg);
        }
        else {
            console.dlog(`new message by ${chatId}`, msg.date);
            sendMessageLogic(msg);
        }
    }));
    bot.on("callback_query", genAction(async data => {
        let blocks = data.data.split("_");
        if (blocks[0] === "message") {
            if (blocks[1] === "public") await publicMessage(blocks[2]);
            if (blocks[1] === "reject") await rejectMessage(blocks[2]);
            if (blocks[1] === "cencelreject") await cancelRejectMessage();
            if (blocks[1] === "rejectid") await finalRejectMessage(blocks[2], blocks[3]);
            if (blocks[1] === "reply") await replyMessage(blocks[2]);
            if (blocks[1] === "info") await infoMessage(blocks[2]);
        }
        if (blocks[0] === "info"){
            if (blocks[1] === "hide") await hideInfoMessage();
            if (blocks[1] === "save") await saveInfoMessage();
        }
        bot.answerCallbackQuery(data.id).catch(error => {
            console.log(error);
        });
    }));
    bot.on("error", genAction(error => {
        console.log(error);
    }))
}
function sendMessageLogic(msg) {
    let user_id = msg.from.id;
    dbm.userIsBanned(user_id).then(isBanned => {
        if (isBanned) {
            bot.sendMessage(msg.from.id, "Вы забанены в боте!");
        }
        else {
            bot.sendMessage(msg.from.id, "Ваше сообщение отправлено на модерацию.");
            sendMessageToModeration(msg);
        }
    });
}
function sendMessageToModeration(msg) {
    let internalId = `${msg.chat.id}:${msg.message_id}`;
    bot.copyMessage(SPECIAL_GROUP_ID, msg.chat.id, msg.message_id, {
        reply_markup: messageButtonsGenerator(true, internalId)
    }).then(msgCopy => {
        dbm.regMessage(internalId, msgCopy.message_id, 0, "moderation", msg.chat.id, msg.date);
    })
}

function messageButtonsGenerator(isLine1, internalId){
    let publicButton = {text: `Упобликовать`, callback_data: `message_public_${internalId}`};
    let rejectButton = {text: `Отклонить`, callback_data: `message_reject_${internalId}`};
    let replyButton = {text: `Ответить`, callback_data: `message_reply_${internalId}`};
    let infoButton = {text: `Информация`, callback_data: `message_info_${internalId}`};
    let line1 = [publicButton, rejectButton];
    let line2 = [replyButton, infoButton];
    return {
        inline_keyboard: isLine1
            ? [line1,line2]
            : [line2]
    };
}

var commandExecuters = [];
function regCommand(name, isOnGroup, action) {
    commandExecuters.push([name, isOnGroup, action]);
}
function onCommand(msg) {
    const chatId = msg.chat.id;
    const text = msg.text.substring(1);
    const args = text.split(" ");
    if (args.length === 0) return;
    const command = args[0];
    let flag = false;
    for (let commandExecuter of commandExecuters) {
        if (commandExecuter[0] === command) {
            if (
                commandExecuter[1] === undefined ||
                (commandExecuter[1] && chatId === SPECIAL_GROUP_ID) ||
                (!commandExecuter[1] && chatId !== SPECIAL_GROUP_ID)
            ) {
                commandExecuter[2](msg);
                flag = true;
            }
        }
    }
    if (!flag) {
        bot.sendMessage(chatId, "неизвестная команда. Попробуйте /help");
    }
}

function regUserOnMessage(user) {
    dbm.getUserData(user.id).then(data => {
        if (data === null){
            let userData = {
                user_id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                username: user.username,
            };
            dbm.saveUserData(userData);
        }
    })
}
regCommand("start", false, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        `
Привет!
Это бот-предложка канала "Прослушка 878".

Искренне просим вас соблюдать правила правила,
которые указаны в закрепленном сообщении,
ведь мы не хотим чтобы канал быстро удалили.

Мы надеемся, что вам нравится наш канал!
При поддержке (без поддержки, сами всё делали)
  `,
    );
});
regCommand("start", true, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        `
Привет!
Это бот-предложка канала "Прослушка 878".

Для того, чтобы получить подробный гайд для админа, напишите /help
  `,
    );
});
regCommand("help", false, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        `
Привет!
Данный бот позволяет тебе написать сообщение в канал,
Для того чтобы написать сообщение в канал,
нужно просто написать сообщение в этом чате!
  `,
    );
});
regCommand("help", true, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        `
Привет!
В админке ты можешь модерировать контент, который пишут пользователи!
Так же ты можешь банить или мутить пользователей.

Список команд:
 - /start - начать работу с ботом
 - /help - получить подсказки
 - /ban <user_id> <reason> - забанить пользователя
 - /unban <user_id> - разбанить пользователя
 - /mute <user_id> <time> - замутить пользователя на (time) часов
 - /unmute <user_id> - размутить пользователя досрочно
 - /banlist - список забаненных пользователей
 - /userlist - список пользователей
 - /history <user_id> - посмотреть историю сообщений пользователя
 - /hmanager <user_id> <operation> - TODO: позволяет редактировать историю сообщений пользователя

Список операций с модерируемым сообщением:
 - Упобликовать: Сообщение отправляется в тгк
 - Отклонить: в таком случае вы сможете указать причину отклонения
 - Ответить: Просто ответьте на сообщение, и нажмите кнопку "Ответить"
 - Информация: Покажет информацию о сообщении
  `,
    );
});
regCommand("ban", true, (msg) => {
    let blocks = msg.text.split(" ");
    if (blocks.length === 1){
        bot.sendMessage(SPECIAL_GROUP_ID, "вы не указали id пользователя");
        return;
    }
    let user_id = blocks[1];
    dbm.getBannedUserData(user_id).then(data => {
        if (data) {
            bot.sendMessage(SPECIAL_GROUP_ID, "пользователь уже забанен");
            return;
        }
        if (blocks.length < 3) {
            bot.sendMessage(SPECIAL_GROUP_ID, "вы не указали причину бана");
            return;
        }
        let reason = msg.text.substring(blocks[0].length + blocks[1].length + 2);
        dbm.banUser(user_id, reason).then(() => {
            bot.sendMessage(SPECIAL_GROUP_ID, `пользователь ${user_id} успешно забанен по причине: "${reason}"!`);
        });
    });
});
regCommand("unban", true, msg => {
    let blocks = msg.text.split(" ");
    if (blocks.length === 1){
        bot.sendMessage(SPECIAL_GROUP_ID, "вы не указали id пользователя");
        return;
    }
    let user_id = blocks[1];
    dbm.getBannedUserData(user_id).then(data => {
        if (data) {
            dbm.unbanUser(user_id).then(() => {
                bot.sendMessage(SPECIAL_GROUP_ID, `пользователь ${user_id}, ранее обвинённый по причине "${data.reason}" успешно разбанен!`);
            });
            return;
        }
        bot.sendMessage(SPECIAL_GROUP_ID, "пользователь не забанен");
    });
});
regCommand("banlist", true, msg => {
    dbm.getBannedUsers().then(async banUsersData => {
        let text = "Список забанненых пользователей: ";
        for (let banUserData of banUsersData) {
            userData = (await dbm.getUserData(banUserData.user_id)) || {
                user_id: banUserData.user_id,
                username: "типаникнейм",
            };
            text+=`\n${userData.user_id}(@${userData.username}) - ${banUserData.reason}`
        }
        bot.sendMessage(SPECIAL_GROUP_ID, text);
    });
});
regCommand("stop", true, msg => {
    stop();
});

async function publicMessage(internalId){
    let msgData = await dbm.getMessage(internalId);

    let channelMsg = await bot.copyMessage(SPECIAL_CHANNEL_ID, SPECIAL_GROUP_ID, msgData.message_group_id, {
        reply_markup: undefined
    });

    return void await Promise.all([
        bot.sendMessage(msgData.user_id, `Ваш пост был опубликован!`),
        bot.editMessageReplyMarkup(messageButtonsGenerator(false, internalId), {chat_id: SPECIAL_GROUP_ID, message_id: msgData.message_group_id}),
        dbm.replaceMessage(internalId, msgData.message_group_id, channelMsg.message_id, "publish", msgData.user_id, msgData.date),
    ]);
}
let selectRejectReasonMessage = null;
async function rejectMessage(internalId){
    cancelRejectMessage();

    selectRejectReasonMessage = await bot.sendMessage(SPECIAL_GROUP_ID, `Выберите причину отклонения сообщения\nучтите, все причины кроме "тихое отклонение" уведомляют пользователя о том, что вы отклонили его сообщение.`, {
        reply_markup: {
            inline_keyboard: [
                [{text: "отмена", callback_data: `message_cencelreject`}],
                [{text: "мат", callback_data: `message_rejectid_${internalId}_1`}],
                [{text: "оскорбление", callback_data: `message_rejectid_${internalId}_2`}],
                [{text: "18+", callback_data: `message_rejectid_${internalId}_3`}],
                [{text: "смысла 0", callback_data: `message_rejectid_${internalId}_4`}],
                [{text: "Нарушение правил", callback_data: `message_rejectid_${internalId}_5`}],
                [{text: "без причины", callback_data: `message_rejectid_${internalId}_6`}],
                [{text: "тихое отклонение", callback_data: `message_rejectid_${internalId}_0`}],
            ]
        }
    });
}
async function cancelRejectMessage(){
    if (selectRejectReasonMessage) {
        await bot.deleteMessage(SPECIAL_GROUP_ID, selectRejectReasonMessage.message_id);
    }
    selectRejectReasonMessage = null;
}
async function finalRejectMessage(internalId, rejectId) {
    // данные о сообщение, которое мы хотим отклонить
    let msgData = await dbm.getMessage(internalId);
    if (msgData.result !== "moderation") return;


    // текст с причиной отклонения
    let rejectText = "";
    // временный промис, который будет заменён промисом с сообщением, если такого будет отправляться пользователю
    let msgPromise = new Promise(resolve => resolve());
    if (rejectId!=="0"){
        if (rejectId==="1") rejectText = "сообщение отклонено, так как содержит мат.";
        else if (rejectId==="2") rejectText = "сообщение отклонено из за наличия оскорблений.";
        else if (rejectId==="3") rejectText = "сообщение отклонено из за наличия 18+ контента.";
        else if (rejectId==="4") rejectText = "смысла 0, сообщение отклонено";
        else if (rejectId==="5") rejectText = "сообщение отклонено за нарушение правил";
        else if (rejectId==="6") rejectText = "сообщение было отклонено без указания чёткой причины.";
        msgPromise = bot.sendMessage(internalId.split(/:/)[0], rejectText);
    }
    else rejectText = "Тихое отклонение";

    return void await Promise.all([
        // ожидание промиса сообщения
        msgPromise,
        // удаление кнопок "Упобликовать", "Отклонить"
        bot.editMessageReplyMarkup(messageButtonsGenerator(false, internalId), {
            chat_id: SPECIAL_GROUP_ID,
            message_id: msgData.message_group_id
        }),
        // удаление меню выбора причины отклонения
        cancelRejectMessage(),
        // работа с бд
        dbm.replaceMessage(internalId, msgData.message_group_id, msgData.message_channel_id, `reject:${rejectId}`, msgData.user_id, msgData.date),
    ]);
}
async function replyMessage(internalId){
    bot.sendMessage(SPECIAL_GROUP_ID, `для того чтобы ответить на сообщение, используйте функцию телеграмма "ответить" а после выберите "отправить пользователю"`).then(msg => {
        setTimeout(() => bot.deleteMessage(SPECIAL_GROUP_ID, msg.message_id), 3000);
    });
}
let selectInfoMessage = null;
async function infoMessage(internalId){
    hideInfoMessage();

    let msgData = await dbm.getMessage(internalId);
    let userData = await dbm.getUserData(msgData.user_id);
    selectInfoMessage = await bot.sendMessage(SPECIAL_GROUP_ID, generateInfoMessage(msgData, userData), {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{text: "скрыть", callback_data: `info_hide`}],
                [{text: "оставить", callback_data: `info_save`}],
            ]
        }
    });
}
async function hideInfoMessage(){
    if (selectInfoMessage){
        await bot.deleteMessage(SPECIAL_GROUP_ID, selectInfoMessage.message_id);
    }
    selectInfoMessage = null;
}
async function saveInfoMessage(){
    if (selectInfoMessage){
        await bot.editMessageReplyMarkup(null, {
            chat_id: SPECIAL_GROUP_ID,
            message_id: selectInfoMessage.message_id,
        });
        selectInfoMessage = null;
    }
}
function generateInfoMessage(msgData, userData){
    userData = userData || {user_id: 0, username: "типоникнейм"};
    let uz = (!userData.username || userData.username === "")
        ? ""
        : `<b>(@${userData.username})</b>`;
    let text = `
отправитель: <span class="tg-spoiler"><a href="tg://user?id=${userData.user_id}">${userData.user_id}</a>${uz}</span>
время отправки: ${msgData.date}
результат: ${msgData.result}

<a href="t.me/${SPECIAL_CHANNEL_LINK_ID}/${msgData.message_channel_id}">ссылка на сообщение в тгк</a>
`
    return text;
}

function start() {
    dbm.initDB().then(result => {
        if (result){
            initBotActions();
        }
        else console.log("ERROR OF RUNNING DB");
    });
}
function stop() {
    hideInfoMessage();
    cancelRejectMessage();
    // Закрываем подключение к базе данных
    dbm.db.close((err) => {
        if (err) {
            console.error("Ошибка при закрытии базы данных:", err.message);
        } else {
            console.log("База данных закрыта.");
        }
    });
}


start();