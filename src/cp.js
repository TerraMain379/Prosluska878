class TelegramBot {
    constructor(token) {
        this.token = token;
        this.executers = {};
        this.intervalTimeout = 400;
    }
    on(event, action) {
        this.executers[event] = action;
    }
    _runEvent(event, ...args) {
        let executer = this.executers[event];
        if (executer) executer(...args);
    }

    _request(path, data) {
        if (!data) data = {};
        else if (typeof data !== "string") {
            data = JSON.stringify(data);
        }

        let url = `https://api.telegram.org/bot${this.token}/${path}`;

        return new Promise(async (resolve, reject) => {
            fetch(url, {
                method: "POST",
                body: data,
                headers: {
                    "Content-Type": "application/json",
                },
            }).then(async response => {
                if (response.ok) {
                    resolve(response.json());
                }
                else {
                    this._runEvent("error", "FETCH_STATUS_NOT_OK");
                    reject(response);
                }
            }).catch(e => {
                this._runEvent("error", "FETCH_ERROR", e);
                reject(e);
            });
        });

    }

    startBot() {
        this.interval = setInterval(() => {
            this._botTick();
        }, this.intervalTimeout)
    }


    _botTick() {
        bot._request("getUpdates", {

        }).then(answer => {
            for (let update of answer.result) {
                let updateTypes = [
                    "message",
                    "edited_message",
                    "channel_post",
                    "edited_channel_post",
                    "business_connection",
                    "business_message",
                    "edited_business_message",
                    "deleted_business_messages",
                    "message_reaction",
                    "message_reaction_count",
                    "inline_query",
                    "chosen_inline_result",
                    "callback_query",
                    "shipping_query",
                    "pre_checkout_query",
                    "purchased_paid_media",
                    "poll",
                    "poll_answer",
                    "my_chat_member",
                    "chat_member",
                    "chat_join_request",
                    "chat_boost",
                    "removed_chat_boost",
                ];
                for (let updateType of updateTypes) {
                    if (update[updateType]) {
                        bot.on(updateType, update[updateType]);
                    }
                }
            }
        });
    }
}



let bot = new TelegramBot("7799957822:AAF3GiqgU1xuYfHbPTtZCUSw8BCLpO8oEIs");
bot._request("getUpdates", {
    timeout: 0,
    limit: 100,
    offset: 0,
}).then(answer => {
    for (let update of answer.result) {
        console.log(update);
    }
    console.log(1);
});
