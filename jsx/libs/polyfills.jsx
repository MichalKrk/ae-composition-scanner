// Polyfills for ExtendScript (ES3 compatibility)

// --- Object.keys polyfill ---
if (!Object.keys) {
    Object.keys = function(obj) {
        var keys = [];
        for (var k in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, k)) {
                keys.push(k);
            }
        }
        return keys;
    };
}

// --- Array.prototype.forEach polyfill ---
if (!Array.prototype.forEach) {
    Array.prototype.forEach = function(callback, thisArg) {
        for (var i = 0; i < this.length; i++) {
            if (i in this) {
                callback.call(thisArg, this[i], i, this);
            }
        }
    };
}

// --- Array.prototype.map polyfill ---
if (!Array.prototype.map) {
    Array.prototype.map = function(callback, thisArg) {
        var arr = [];
        for (var i = 0; i < this.length; i++) {
            if (i in this) {
                arr[i] = callback.call(thisArg, this[i], i, this);
            }
        }
        return arr;
    };
}

// --- Array.prototype.filter polyfill ---
if (!Array.prototype.filter) {
    Array.prototype.filter = function(callback, thisArg) {
        var arr = [];
        for (var i = 0; i < this.length; i++) {
            if (i in this && callback.call(thisArg, this[i], i, this)) {
                arr.push(this[i]);
            }
        }
        return arr;
    };
}

// --- String.prototype.indexOf polyfill ---
if (!String.prototype.indexOf) {
    String.prototype.indexOf = function(searchString, position) {
        var str = String(this);
        var searchStr = String(searchString);
        var pos = position || 0;

        if (pos < 0) pos = 0;
        if (pos > str.length) return -1;

        for (var i = pos; i <= str.length - searchStr.length; i++) {
            var match = true;
            for (var j = 0; j < searchStr.length; j++) {
                if (str.charAt(i + j) !== searchStr.charAt(j)) {
                    match = false;
                    break;
                }
            }
            if (match) return i;
        }
        return -1;
    };
}

// --- Array.prototype.indexOf polyfill ---
if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function(searchElement, fromIndex) {
        var len = this.length;
        var i = fromIndex || 0;
        for (; i < len; i++) {
            if (this[i] === searchElement) {
                return i;
            }
        }
        return -1;
    };
}

// --- Array.prototype.push polyfill ---
// (Usually native in ES3, but just in case)
if (!Array.prototype.push) {
    Array.prototype.push = function() {
        for (var i = 0; i < arguments.length; i++) {
            this[this.length] = arguments[i];
        }
        return this.length;
    };
}

// --- Array.prototype.sort polyfill ---
// (Usually native in ES3, but just in case)
if (!Array.prototype.sort) {
    Array.prototype.sort = function(compareFn) {
        // Simple bubble sort implementation
        var len = this.length;
        for (var i = 0; i < len - 1; i++) {
            for (var j = 0; j < len - i - 1; j++) {
                var a = this[j];
                var b = this[j + 1];
                var shouldSwap = false;

                if (compareFn) {
                    shouldSwap = compareFn(a, b) > 0;
                } else {
                    // Default: convert to strings and compare
                    shouldSwap = String(a) > String(b);
                }

                if (shouldSwap) {
                    this[j] = b;
                    this[j + 1] = a;
                }
            }
        }
        return this;
    };
}

// --- Array.isArray polyfill ---
if (!Array.isArray) {
    Array.isArray = function(arg) {
        return Object.prototype.toString.call(arg) === '[object Array]';
    };
}

// --- String.prototype.trim polyfill ---
if (!String.prototype.trim) {
    String.prototype.trim = function() {
        return this.replace(/^\s+|\s+$/g, '');
    };
}

// --- String.prototype.toLowerCase polyfill ---
// (Usually native, but just in case)
if (!String.prototype.toLowerCase) {
    String.prototype.toLowerCase = function() {
        var str = '';
        for (var i = 0; i < this.length; i++) {
            var c = this.charAt(i);
            var code = this.charCodeAt(i);
            if (code >= 65 && code <= 90) {
                str += String.fromCharCode(code + 32);
            } else {
                str += c;
            }
        }
        return str;
    };
}

// --- String.prototype.toUpperCase polyfill ---
// (Usually native, but just in case)
if (!String.prototype.toUpperCase) {
    String.prototype.toUpperCase = function() {
        var str = '';
        for (var i = 0; i < this.length; i++) {
            var c = this.charAt(i);
            var code = this.charCodeAt(i);
            if (code >= 97 && code <= 122) {
                str += String.fromCharCode(code - 32);
            } else {
                str += c;
            }
        }
        return str;
    };
}

// --- String.prototype.split polyfill ---
// (Usually native, but ensuring compatibility)
if (!String.prototype.split) {
    String.prototype.split = function(separator, limit) {
        var str = String(this);
        var result = [];

        if (!separator) {
            return [str];
        }

        if (separator === '') {
            for (var i = 0; i < str.length && (!limit || i < limit); i++) {
                result.push(str.charAt(i));
            }
            return result;
        }

        var sepStr = String(separator);
        var pos = 0;
        var count = 0;

        while (pos < str.length && (!limit || count < limit)) {
            var idx = str.indexOf(sepStr, pos);
            if (idx === -1) {
                result.push(str.substring(pos));
                break;
            }
            result.push(str.substring(pos, idx));
            pos = idx + sepStr.length;
            count++;
        }

        return result;
    };
}

// --- Date.prototype.toISOString polyfill ---
if (!Date.prototype.toISOString) {
    Date.prototype.toISOString = function() {
        function pad(num) {
            var s = String(num);
            if (s.length < 2) {
                s = '0' + s;
            }
            return s;
        }

        return this.getUTCFullYear() + '-' +
            pad(this.getUTCMonth() + 1) + '-' +
            pad(this.getUTCDate()) + 'T' +
            pad(this.getUTCHours()) + ':' +
            pad(this.getUTCMinutes()) + ':' +
            pad(this.getUTCSeconds()) + '.' +
            String((this.getUTCMilliseconds() / 1000).toFixed(3)).slice(2, 5) + 'Z';
    };
}