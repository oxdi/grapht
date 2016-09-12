#!/bin/bash
(
	cd ../../../ &&
	echo '' > data/jstest &&
	./bin/grapht >/dev/null &
) && xvfb-run npm test

kill `ps aux | grep bin/grapht | awk '{print $2}'` 2>/dev/null >/dev/null
