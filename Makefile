install: buildbot_js_deps.tgz
	cd ../config/public_html; ln -sf ../../buildbot.js js
buildbot_js_deps.tgz:
	wget http://buildbot.tl.intel.com/buildbot_js_deps.tgz
	tar xzf buildbot_js_deps.tgz
.PHONY: release
release:
	util/buildscripts/build.sh --bin java -p build.js --release
	cd ../config/public_html; rm js; ln -sf ../../buildbot.js/release/dojo js
