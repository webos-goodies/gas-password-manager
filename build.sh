#! /bin/sh

python closure-library/closure/bin/build/closurebuilder.py -n gaspass.App -o compiled --output_file assets/gaspass.js --root=closure-library --root=app/js -c closure-compiler/compiler.jar -f "--compilation_level=ADVANCED_OPTIMIZATIONS" -f "--output_wrapper='(function(){%output%})();'" -f "--externs=app/externs/app.js"
