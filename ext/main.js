Sidebar.callAPI('execute.connect', {
	done: function (API) {
		$.getJSON('lang/i18n.json', function(json, textStatus) {
			Sidebar.i18n = json;

			if (!$.isEmptyObject(API.count)) {
				opr.sidebarAction.setBadgeText({text: '+'+API.count.messages});
			}

			// Подготовка профилей
			Sidebar.profiles = [];
			API.profiles.forEach(function (user) {
				user = new User(user);
				Sidebar.profiles[user.id] = user;
			});
			Sidebar.current = new User(API.current);

			// Построение диалогов
			$(API.dialogs.reduce(function (frag, dialog) {
				var unread = dialog.unread || '';
				var author = new User(dialog.message.user_id);
				var cssClass = '';
				if (author.online) {
					cssClass += ' online';
					if (author.online_mobile) {
						cssClass += ' mobile';
					}
				}
				$('<div id="user-'+author.id+'" class="dialog'+cssClass+'" data-unread="'+unread+'">' + author.ava() + author.name.bold() + '</div>').data({'unread': dialog.unread, 'user':author}).appendTo(frag);
				return $(frag);
			}, document.createDocumentFragment())).appendTo('.contacts');


			// Запустить обновления
			Sidebar.LongPoll = API.LongPoll;
			Sidebar.LongPollStart();

			$('header').on('click', '.button', function(){
				$('.history').add('header .button').addClass('hide');
				$('.contacts').add('header .title').removeClass('hide');
			});

			$('.contacts').on('click', '.dialog', function () {
				var user = $(this).data('user'),
					$dialog = $('#dialog-'+user.id);
				if ($dialog.length === 0) {
					var cssClass = '';
					if (user.online) {
						cssClass += ' online';
						if (user.online_mobile) {
							cssClass += ' mobile';
						}
					}
					$dialog = $('<div id="dialog-'+user.id+'" class="history hide"><div class="header"><div class="user'+cssClass+'">'+user.name.bold()+'</div><div class="create_message"><textarea></textarea><button><span>' + Sidebar.loc('Send') + '</span></button></div></div><div class="body"></div></div>').data('user', user).appendTo('body');
					Sidebar.callAPI('execute.getHistory', {
						data: {
							user_id: user.id,
							count: 100
						},
						done: function (API) {
							console.warn(API);
							API.profiles.forEach(function (user) {
								user = new User(user);
								Sidebar.profiles[user.id] = user;
							});

							$(API.items.reduce(function (frag, mess) {
								mess = new Message(mess);
								return $(frag).append(mess.getHtml());
							}, document.createDocumentFragment())).appendTo($dialog.find('.body'));
						}
					});
				}
				$('.contacts').add('header .title').addClass('hide');
				$dialog.add('header .button').removeClass('hide');
			});

			$('body').on('click', '.history button', Sidebar.sendMess );
			$('body').on('keypress', '.history textarea', Sidebar.sendMess );
		});
	}
});

