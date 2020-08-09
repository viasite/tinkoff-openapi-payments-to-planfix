Получает входящие платежи на счёте компании и перенаправляет в Планфикс в виде аналитик.

Скрипт запускается, проверяет, появились ли новые платежи, если да, то отправляет их в Планфикс.

Данные об отправленных хранятся в lowdb (локальный json).

Предполагается запускать скрипт по крону:
```
*/10 7-23 * * * cd /home/user/tinkoff-openapi-payments-to-planfix/; npm start >> out.log
```

или в цикле:
```
while true; do node src/index.js >> out.log; sleep 300; done
```

Создание сервиса в systemd (Ubuntu 18.04):

/etc/systemd/system/tinkoff-to-planfix.service:
``` ini
[Unit]
Description=tinkoff-to-planfix
DefaultDependencies=no
After=network.target

[Service]
Type=simple
Restart=always
RestartSec=1
ExecStart=/home/viasite/tinkoff-openapi-payments-to-planfix/tinkoff-to-planfix.sh
TimeoutSec=0
User=viasite

[Install]
WantedBy=multi-user.target
```

tinkoff-to-planfix.sh:
``` bash
#!/bin/bash
set -eu
cd /home/viasite/tinkoff-openapi-payments-to-planfix
while true; do node src/index.js >> out.log; sleep 300; done
```

```
systemctl enable tinkoff-to-planfix.service
service tinkoff-to-planfix start
service tinkoff-to-planfix status
```