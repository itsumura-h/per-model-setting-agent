exec:
	docker compose start
	docker compose exec app bash

main:
	git switch main
	git pull
	git pull -p

diff:
	git diff --cached > .diff
