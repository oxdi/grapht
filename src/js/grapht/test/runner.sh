#!/bin/bash

function cleanup() {
	kill `ps aux | grep bin/grapht | awk '{print $2}'` 2>/dev/null >/dev/null
}

trap 'cleanup' EXIT

(
	cd ../../../ &&
	rm -f data/jstest;
	rm -f data/users.json;
	./bin/grapht --image-host="oxditmp.imgix.net"  >data/jstest.testlog &
) && xvfb-run npm test

