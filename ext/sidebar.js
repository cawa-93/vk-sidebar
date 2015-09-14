var Sidebar = {

	lang:1,
	api: {
		v: '5.37',
		access_token: 'a5c4b8a86954a02b96994d99e25f35a966fda7ec7b7ac395d1d62e618f6d02aaed27a9e54e79c350adecf',
	},

	auth : function () {
		window.open('https://oauth.vk.com/authorize?' + $.param({
			'redirect_uri'	: 'https://oauth.vk.com/blank.html',
			'client_id'		: 5057838,
			'scope'			: 'offline,friends,messages',
			'response_type'	: 'token',
			'display'		: 'popup',
			'v'				: this.api.v,
			'state'			: chrome.app.getDetails().id
		}));
	},


	/**
	 * Обращение у ВК API
	 * @param  {String}	method	Метод API
	 * @param  {Object}	options	Параметры запроса
	 * @see  http://api.jquery.com/jQuery.ajax
	 */
	callAPI: function (method, options) {
		if (typeof method !== 'string') {
			options = method;
			method = options.url;
		} else if (options === undefined) {
			options = {};
		}

		options.data = $.extend({}, this.api, options.data);

		$.ajax($.extend(true, {
			url: 'https://api.vk.com/method/' + method,
			context: this,
			dataType: "json",
			timeout: 10000
		}, options))
		// Обработка удачного запроса
		.done(function (API) {
			if (API.response !== undefined) {
				if (options.done) {
					options.done.call(this, API.response);
				}
			} else {
				console.error(method + ' api error: ' + API.error.error_code + '. ' + API.error.error_msg);
				if (options.fail) {
					options.fail.call(this, API);
				}
			}
		})
		// Обработка ошибки запроса
		.fail([function (jqxhr) {
			console.error(method + ' ajax error; readyState:' + jqxhr.readyState + '; status:' + jqxhr.status + '; statusText:' + jqxhr.statusText);
		}, options.fail])
		// Всегда
		.always(options.always);
	},

	LongPollStart: function () {
		this.isLongPoll = true;
		this.LongPollConnect();
	},

	LongPollStop: function () {
		this.isLongPoll = false;
	},

	LongPollConnect: function () {
		$.ajax({
			url: 'http://'+this.LongPoll.server,
			context: this,
			dataType: "json",
			data: {
				act: 'a_check',
				key: this.LongPoll.key,
				ts : this.LongPoll.ts,
				wait : 25,
				mode : 2+64,
			}
		}).done(function (API) {
			this.LongPoll.ts = API.ts;
			API.updates.forEach(function(event){
				console.warn(event[0], event);
				switch(event[0]) {
					case 4	: Sidebar.addMess(event); 								break;
					case 6	: case 7 : Sidebar.clearUnread(event);					break;
					case 8	: case 9 : Sidebar.changeStatus(event);					break;
					case 61	: Sidebar.write(event);									break;
					case 80	: opr.sidebarAction.setBadgeText({text: (event[1] > 0 ? '+'+event[1] : '' )});	break;
				}
			});

			if (this.isLongPoll) {
				this.LongPollConnect();
			}

		}).fail(function (a) {
			console.error(a);
			setTimeout($.proxy(this, 'LongPollConnect'), 5000);
		});
	},

	changeStatus: function (event) {
		var $dialog = $('#user'+event[1]).add('#dialog-'+event[1] + ' .user').toggleClass('online');
		if (event[0] == 8 && event[1] < 6) $dialog.addClass('mobile');
		else $dialog.removeClass('mobile');
	},

	write: function (event) {
		var $dialog = $('#user-'+event[1]).data('write', $.now()),
			interval = $dialog.data('interval');
		if (!interval) {
			$dialog.addClass('write').data('interval', setInterval(function(){
				if ($.now() - $dialog.data('write') > 6000) {
					clearInterval($dialog.removeClass('write').data('interval'));
					$dialog.data('interval', 0);
				}
			}, 1000));
		}
	},

	clearUnread: function (event) {
		$('#user-'+event[1]).attr('data-unread', '').data('unread', 0);
		if ($('#dialog-'+event[1]).length === 1) {
			var cl = event[0] == 6 ? 'in' : 'out';
			var $target = $('#dialog-'+event[1]).find('#mess-'+event[2]);
			$target.nextAll('.dialog.unread.'+cl).removeClass('unread');
			if ($target.hasClass(cl)) $target.removeClass('unread');
		}
	},

	addMess: function (event) {
		var flag = this.parseFlag(event[2]);
		var $dialog = $('#user-'+event[3]);

		if ($dialog.length === 0) {
			var unread = flag.UNREAD ? 1 : '';
			var author = new User(event[3]);
			var cssClass = '';
			if (author.online) {
				cssClass += ' online';
				if (author.online_mobile) {
					cssClass += ' mobile';
				}
			}
			$dialog = $('<div id="user-'+event[3]+'" class="dialog'+cssClass+'" data-unread="'+unread+'">' + author.ava() + author.name.bold() + '</div>');
		}

		if (!flag.OUTBOX) {
			var unread = $dialog.data('unread')+1;
			$dialog.attr('data-unread', unread).data('unread', unread);
		}

		$('.contacts').prepend($dialog);

		if ($('#dialog-'+event[3]).length === 1) {
			var mess = {
				id: event[1],
				date: event[4],
				body: event[6],
				out: flag.OUTBOX,
				read_state: 0,
				from_id: flag.OUTBOX ? this.current.id : event[3],
				attachments: event[7],
			}
			$('#dialog-'+event[3]).find('.body').prepend(new Message(mess).getHtml());
		}
	},
	sendMess: function(event) {
		if (event.type === 'click' || (event.keyCode === 10)) {
			var $dialog = $(this).parents('.history');
			var text = $dialog.find('textarea').val();
			if (text !== '') {
				var user = $dialog.data('user');
				$dialog.find('button').attr('disabled', 'disabled');
				Sidebar.callAPI('messages.send', {
					data: {
						user_id: user.id,
						message: text
					},
					context:$dialog,
					done: function (API) {
						$(this).find('textarea').val('');
					},
					always: function () {
						$(this).find('button').removeAttr('disabled');
					}
				});
			}
		}
	},


	parseFlag: function (flag) {
		var res = {
				MEDIA: false,
				FIXED: false,
				DELЕTЕD: false,
				SPAM: false,
				FRIENDS: false,
				CHAT: false,
				IMPORTANT: false,
				REPLIED: false,
				OUTBOX: false,
				UNREAD: false,
			},
			map = {
				MEDIA: 512,
				FIXED: 256,
				DELЕTЕD: 128,
				SPAM: 64,
				FRIENDS: 32,
				CHAT: 16,
				IMPORTANT: 8,
				REPLIED: 4,
				OUTBOX: 2,
				UNREAD: 1,
			}
		for (key in map) {
			if (flag >= map[key]) {
				res[key] = true;
				if (flag === map[key]) return res;
				flag -= map[key];
			}
		}
		return res;
	},




	/**
	 * Возвращает строку перевода
	 * @param  {String}  text		 Строка для перевода.
	 * @param  {Boolean} isRequared  Возвращать строку или undefined
	 * @return {String|undefined}	 Строка перевода или undefined.
	 */
	loc: function (text, isRequared) {
		if (isRequared === false) {
			var def = undefined;
		} else {
			var def = text;
		}

		if (!text || !this.i18n) {
			return def;
		}

		if (this.i18n[text] && this.i18n[text][this.lang]) {
			return this.i18n[text][this.lang];
		} else {
			return def;
		}
	},
};