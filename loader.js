(function(global){
	global = global || window;
	modules = {};
	loadings = [];
	loadedJs = [];
	//module: id, state, factory, result, deps;
	global.require = function(deps, callback, parent){
		var id = parent || "Bodhi" + Date.now();
		var cn = 0, dn = deps.length;
		var args = [];
		
		var oriDeps = deps.slice();//保留原始dep的模块Id
		
		 // dep为非绝对路径形式，而modules的key仍然需要绝对路径
		deps = deps.map(function(dep) {
			if (modules[dep]) { //jquery 
				return dep;
			} else if (dep in global.require.parsedConfig.paths) {
				return dep;
			}
			var rel = "";
			if (/^Bodhi/.test(id)) {
				rel = global.require.parsedConfig.baseUrl;
			} else {
				var parts = parent.split('/');
				parts.pop();
				rel = parts.join('/');
			}
			return getModuleUrl(dep, rel);
		});
		
		var module = {
			id: id,
			deps: deps,
			factory: callback,
			state: 1,
			result: null
		};
		modules[id] = module;
		
		if (checkCircleRef(id, id)) {
			return;
		}
		
		deps.forEach(function(dep, i) {
			if (modules[dep] && modules[dep].state === 2) {
				cn++
				args.push(modules[dep].result);
			} else if (!(modules[dep] && modules[dep].state === 1) && loadedJs.indexOf(dep) === -1) {
				loadJS(dep, oriDeps[i]);
				loadedJs.push(dep);
			}
		});
		if (cn === dn) {
			callFactory(module);
		} else {
			loadings.push(id);
			checkDeps();
		}
	};
	
	global.require.config = function(config) {
		this.parsedConfig = {};
		if (config.baseUrl) {
			var currentUrl = getCurrentScript();
			var parts = currentUrl.split('/');
			parts.pop();
			var currentDir = parts.join('/');
			this.parsedConfig.baseUrl = getRoute(currentDir, config.baseUrl);
		}
		var burl = this.parsedConfig.baseUrl;
		// 得到baseUrl后，location相对baseUrl定位
		this.parsedConfig.packages = [];
		if (config.packages) {
			for (var i = 0, len = config.packages.length; i < len; i++) {
				var pck = config.packages[i];
				var cp = {
					name: pck.name,
					location: getRoute(burl, pck.location)
				}
				this.parsedConfig.packages.push(cp);
			}
		}
		
		
		this.parsedConfig.paths = {};
		if (config.paths) {
			for (var p in config.paths) {
				this.parsedConfig.paths[p] = /^http(s)?/.test(config.paths[p]) ? config.paths[p] : getRoute(burl, config.paths[p]);
			}
		}
		
		this.parsedConfig.map = {};
		if (config.map) {
			this.parsedConfig.map = config.map;
		}
		
		this.parsedConfig.shim = {};
		//shim 要放在最后处理
		if (config.shim) {
			this.parsedConfig.shim = config.shim;
			for (var p in config.shim) {
				var item = config.shim[p];
				define(p, item.deps, function() {
					var exports;
					if (item.init) {
						exports = item.init.apply(item, arguments);
					}
					
					return exports ? exports : item.exports;
				});
			}
		}
		
		console.log(this.parsedConfig);
	}
	
	global.define = function(id, deps, callback) {
		//加上moduleId的支持
		if (typeof id !== "string" && arguments.length === 2) {
			callback = deps;
			deps = id;
			id = "";
		}
		var id = id || getCurrentScript();
		
		var script = document.querySelector('script[src="' + id + '"]');
		if (script || id in require.parsedConfig.shim) {
			var mId = script ? script.getAttribute('data-moduleId') : id;
			var maping = getMapSetting(mId);
			
			if (maping) {
				deps = deps.map(function(dep) {
					return maping[dep] || dep;
				});
			}
		}
		if (modules[id]) {
			console.error('multiple define module: ' + id);
		}
		
		require(deps, callback, id);
	};
	
	global.define.amd = {};//AMD规范
	
	function getMapSetting(mId) {
		if (mId in require.parsedConfig.map) {
			return require.parsedConfig[mId];
		} else if ('*' in require.parsedConfig.map) {
			return require.parsedConfig.map['*'];
		} else {
			return null;
		}
	};
	
	function checkCircleRef(start, target){
		var m = modules[start];
		if (!m) {
			return false;
		}
		var depModules = m.deps.map(function(dep) {
			return modules[dep] || null;
		});
		
		
		return depModules.some(function(m) {
			if (!m) {
				return false;
			}
			return m.deps.some(function(dep) {
				var equal = dep === target;
				if (equal) {
					console.error("circle reference: ", target, m.id);
				}
				
				return equal;
			});
		}) ? true : depModules.some(function(m) {
			if (!m) {
				return false;
			}
			return m.deps.some(function(dep) {
				return checkCircleRef(dep, target);
			});
		});
		
		//return hasCr ? true: 
	};
	
	function getRoute(base, target) {
		var bts = base.replace(/\/$/, "").split('/');  //base dir
		var tts = target.split('/'); //target parts
		while (isDefined(tts[0])) {
			if (tts[0] === '.') {
				return bts.join('/') + '/' + tts.slice(1).join('/');
			} else if (tts[0] === '..') {
				bts.pop();
				tts.shift();
			} else {
				return bts.join('/') + '/' + tts.join('/');
			}
		}
	};
	
	function isDefined(v) {
		return v !== null && v !== undefined;
	};
	
	function getModuleUrl(moduleId, relative) {
		function getPackage(nm) {
			for (var i = 0, len = require.parsedConfig.packages.length; i < len; i++) {
				var pck = require.parsedConfig.packages[i];
				if (nm === pck.name) {
					return pck;
				}
			}
			return false;
		}
		var mts = moduleId.split('/');
		var pck = getPackage(mts[0]);
		if (pck) {
			mts.shift();
			return getRoute(pck.location, mts.join('/'));
		} else if (mts[0] === '.' || mts[0] === '..') {
			return getRoute(relative, moduleId);
		} else {
			return getRoute(require.parsedConfig.baseUrl, moduleId);
		}
	};
	
	function loadJS(url, mId) {
		var script = document.createElement('script');
		script.setAttribute('data-moduleId', mId); //为script元素保留原始模块Id
		script.type = "text/javascript";
		//判断模块是否在paths中定义了路径
		script.src = (url in global.require.parsedConfig.paths ? global.require.parsedConfig.paths[url] : url) + '.js';
		script.onload = function() {
			var module = modules[url];
			if (module && isReady(module) && loadings.indexOf(url) > -1) {
				callFactory(module);
			}
			checkDeps();
		};
		var head = document.getElementsByTagName('head')[0];
		head.appendChild(script);
	};
	
	function checkDeps() {
		for (var p in modules) {
			var module = modules[p];
			if (isReady(module) && loadings.indexOf(module.id) > -1) {
				callFactory(module);
				checkDeps(); // 如果成功，在执行一次，防止有些模块就差这次模块没有成功
			}
		}
	};
	
	function isReady(m) {
		var deps = m.deps;
		var allReady = deps.every(function(dep) {
			return modules[dep] && isReady(modules[dep]) && modules[dep].state === 2;
		})
		if (deps.length === 0 || allReady) {
			return true;
		}
	};
	
	function callFactory(m) {
		var args = [];
		for (var i = 0, len = m.deps.length; i < len; i++) {
			args.push(modules[m.deps[i]].result);
		}
		m.result = m.factory.apply(window, args);
		m.state = 2;
		
		var idx = loadings.indexOf(m.id);
		if (idx > -1) {
			loadings.splice(idx, 1);
		}
	};
	
	function getCurrentScript(base) {
        // 参考 https://github.com/samyk/jiagra/blob/master/jiagra.js
        var stack;
        try {
            a.b.c(); //强制报错,以便捕获e.stack
        } catch (e) { //safari的错误对象只有line,sourceId,sourceURL
            stack = e.stack;
            if (!stack && window.opera) {
                //opera 9没有e.stack,但有e.Backtrace,但不能直接取得,需要对e对象转字符串进行抽取
                stack = (String(e).match(/of linked script \S+/g) || []).join(" ");
            }
        }
        if (stack) {
            /**e.stack最后一行在所有支持的浏览器大致如下:
             *chrome23:
             * at http://113.93.50.63/data.js:4:1
             *firefox17:
             *@http://113.93.50.63/query.js:4
             *opera12:http://www.oldapps.com/opera.php?system=Windows_XP
             *@http://113.93.50.63/data.js:4
             *IE10:
             *  at Global code (http://113.93.50.63/data.js:4:1)
             *  //firefox4+ 可以用document.currentScript
             */
            stack = stack.split(/[@ ]/g).pop(); //取得最后一行,最后一个空格或@之后的部分
            stack = stack[0] === "(" ? stack.slice(1, -1) : stack.replace(/\s/, ""); //去掉换行符
            return stack.replace(/(:\d+)?:\d+$/i, "").replace(/\.js$/, ""); //去掉行号与或许存在的出错字符起始位置
        }
        var nodes = (base ? document : head).getElementsByTagName("script"); //只在head标签中寻找
        for (var i = nodes.length, node; node = nodes[--i]; ) {
            if ((base || node.className === moduleClass) && node.readyState === "interactive") {
                return node.className = node.src;
            }
        }
    };
})(window)