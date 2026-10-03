window.BR_KNOWLEDGE_DATA = {
  categories: [
    {
      id: 'transport',
      icon: '🚗',
      image: 'assets/images/kb-transport.png',
      title: 'Транспорт',
      subtitle: 'Автомобили, мотоциклы и другой транспорт',
      description: 'Большой каталог транспорта с подразделами, быстрыми командами, гаражами, улучшениями и памятками по использованию.',
      source: 'https://wiki.blackrussia.online/transport?page=20',
      subsections: [
        {
          id: 'cars', title: 'Автомобили', summary: 'Каталог легковых автомобилей',
          items: [
            {title:'Каталог автомобилей и улучшений', meta:'456 позиций • характеристики • тюнинг', text:'Открой каталог: поиск по модели, классу и ID, характеристики и цены по трём центрам. Данные из предоставленного форумного материала.', tags:['авто','машина','каталог','id','цена'], source:'garage.html'},
            {title:'Фильтры по транспорту', meta:'Цена • класс • ID', text:'В интерфейсе предусмотрены быстрые фильтры: по стоимости, классу, типу транспорта и ID. Это удобно, когда игрок ищет конкретную модель.', tags:['фильтр','поиск','транспорт'], source:'https://wiki.blackrussia.online/transport?page=20'},
            {title:'Карточка транспорта', meta:'Название • параметры • фото', text:'Каждая карточка может включать большую фотографию, характеристики, список апгрейдов и кнопку перехода к официальному источнику.', tags:['карточка','фото','характеристики'], source:'https://wiki.blackrussia.online/transport?page=20'}
          ]
        },
        {
          id: 'moto', title: 'Мотоциклы и спецтранспорт', summary: 'Отдельные типы транспорта',
          items: [
            {title:'Мотоциклы', meta:'Категория • подборка', text:'Подраздел под двухколёсный транспорт с отдельными карточками и фильтрацией.', tags:['мото','мотоцикл'], source:'https://wiki.blackrussia.online/transport?page=20'},
            {title:'Спецтранспорт', meta:'Служебный • уникальный', text:'Отдельный блок для редкого, служебного или нестандартного транспорта.', tags:['спецтранспорт','служебный'], source:'https://wiki.blackrussia.online/transport?page=20'}
          ]
        },
        {
          id: 'garage', title: 'Гараж и доставка', summary: 'Управление хранением транспорта',
          items: [
            {title:'Команда /garage', meta:'Гараж • доставка', text:'Официальная справка описывает /garage как точку управления гаражом и доставки транспорта в гараж.', tags:['/garage','гараж','доставка'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/64-transport-management-system/'},
            {title:'Хранение транспорта', meta:'Парковка • загрузка', text:'Гараж удобно использовать как постоянное место хранения купленных автомобилей.', tags:['хранение','гараж','авто'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/64-transport-management-system/'}
          ]
        },
        {
          id: 'controls', title: 'Управление транспортом', summary: 'Основные действия владельца',
          items: [
            {title:'Команда /car', meta:'Управление • GPS • загрузка', text:'Через /car игрок открывает управление личным транспортом: поиск на карте, загрузка и другие быстрые действия.', tags:['/car','транспорт','gps'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/64-transport-management-system/'},
            {title:'Планшет → Транспорт', meta:'Альтернативный доступ', text:'Транспортом можно управлять не только командой, но и через соответствующий раздел в игровом планшете.', tags:['планшет','транспорт'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/64-transport-management-system/'}
          ]
        },
        {
          id: 'upgrades', title: 'Улучшения', summary: 'Тюнинг и апгрейды',
          items: [
            {title:'Улучшения транспорта', meta:'Тюнинг • апгрейды', text:'Этот подраздел рассчитан под перечисление доступных улучшений, различий базовых и прокачанных характеристик, а также визуального тюнинга.', tags:['улучшения','тюнинг','апгрейды'], source:'https://wiki.blackrussia.online/'}
          ]
        }
      ]
    },
    {
      id: 'property',
      icon: '🏠',
      image: 'assets/images/kb-property.png',
      title: 'Недвижимость',
      subtitle: 'Дома, квартиры, гаражи и участки',
      description: 'Полный раздел о жилье и недвижимости: покупка, управление, карта, гаражи и памятки по безопасному оформлению.',
      source: 'https://wiki.blackrussia.online/',
      subsections: [
        {
          id: 'houses', title: 'Дома', summary: 'Покупка и управление домом',
          items: [
            {title:'Покупка дома', meta:'Карта • свободные дома', text:'Свободные дома на карте помечаются зелёным, занятые — красным. После покупки управление доступно через /home.', tags:['дом','покупка','/home'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/41-property-purchase/'},
            {title:'Управление домом', meta:'/home • жильё', text:'Команда /home открывает основные действия владельца дома.', tags:['дом','/home','жильё'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/41-property-purchase/'}
          ]
        },
        {
          id: 'apartments', title: 'Квартиры', summary: 'Жильё в многоквартирных домах',
          items: [
            {title:'Покупка квартиры', meta:'Жильё • интерфейс', text:'Подраздел рассчитан под карточки квартир, расположение, цены и основные отличия от частных домов.', tags:['квартира','жильё'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/41-property-purchase/'}
          ]
        },
        {
          id: 'garages', title: 'Гаражи', summary: 'Хранение транспорта и место выдачи',
          items: [
            {title:'Покупка гаража', meta:'Недвижимость • транспорт', text:'Гаражи выступают отдельным типом недвижимости и одновременно служат для хранения транспорта.', tags:['гараж','недвижимость'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/64-transport-management-system/'},
            {title:'Использование гаража', meta:'/garage • транспорт', text:'После покупки гараж становится точкой управления выдачей и доставкой автомобиля.', tags:['/garage','гараж','автомобиль'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/64-transport-management-system/'}
          ]
        },
        {
          id: 'locations', title: 'Расположение объектов', summary: 'Карта и навигация по недвижимости',
          items: [
            {title:'Каталог объектов', meta:'ID • расположение • ориентиры', text:'В этот блок удобно добавлять ID домов, квартир и гаражей, район, ближайший ориентир и скрин местоположения.', tags:['id','карта','расположение'], source:'https://wiki.blackrussia.online/'}
          ]
        }
      ]
    },
    {
      id: 'businesses',
      icon: '🏢',
      image: 'assets/images/kb-business.png',
      title: 'Бизнесы',
      subtitle: 'Покупка, аукцион, управление и доход',
      description: 'Отдельный блок по бизнесам: как купить, как управлять, кто может стать владельцем и как следить за доходностью.',
      source: 'https://wiki.blackrussia.online/',
      subsections: [
        {
          id: 'buy', title: 'Покупка бизнеса', summary: 'Как стать владельцем',
          items: [
            {title:'Покупка через аукцион', meta:'От 3 уровня • аукцион', text:'Официальная поддержка указывает, что бизнес можно приобрести через аукцион; для покупки нужен как минимум 3 уровень персонажа.', tags:['бизнес','аукцион','покупка'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/89-how-to-become-a-business-owner/'},
            {title:'Подготовка к покупке', meta:'Средства • проверка', text:'Перед участием в аукционе стоит заранее проверить бюджет, тип бизнеса и условия владения.', tags:['подготовка','владение','бизнес'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/89-how-to-become-a-business-owner/'}
          ]
        },
        {
          id: 'manage', title: 'Управление бизнесом', summary: 'Главные функции владельца',
          items: [
            {title:'Команда /business', meta:'Управление • владелец', text:'Через /business владелец открывает основное меню управления своим бизнесом.', tags:['/business','управление','бизнес'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/90-business-management/'},
            {title:'Доход и обслуживание', meta:'Настройка • прибыль', text:'Раздел предназначен под карточки о прибыли, товарах, персонале и обслуживании бизнеса.', tags:['доход','прибыль','обслуживание'], source:'https://wiki.blackrussia.online/'}
          ]
        },
        {
          id: 'catalog', title: 'Каталог бизнесов', summary: 'Виды и параметры',
          items: [
            {title:'Типы бизнесов', meta:'Каталог • виды', text:'Здесь можно показывать разновидности бизнесов, изображения, локации, цены, доходность и особенности.', tags:['каталог','типы','доход'], source:'https://wiki.blackrussia.online/'}
          ]
        }
      ]
    },
    {
      id: 'commands',
      icon: '⌨️',
      title: 'Команды сервера',
      subtitle: 'Полноценный справочник по командам',
      description: 'Собранные по категориям команды игрока, транспорта, дома, бизнеса и безопасности с быстрым поиском по сайту.',
      source: 'https://wiki.blackrussia.online/',
      subsections: [
        {
          id: 'basic', title: 'Основные', summary: 'Команды повседневного использования',
          items: [
            {title:'/mm', meta:'Главное меню игрока', text:'Через /mm можно перейти в ключевые разделы аккаунта и настроек безопасности.', tags:['/mm','игрок','меню'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/122-%D0%BF%D1%80%D0%B8%D0%B2%D1%8F%D0%B7%D0%BA%D0%B0-%D0%B0%D0%BA%D0%BA%D0%B0%D1%83%D0%BD%D1%82%D0%B0/'},
            {title:'Поиск по командам', meta:'Категории • фильтр', text:'Раздел рассчитан на удобный поиск по вводу: команда, назначение, связанный раздел и краткое описание.', tags:['поиск','команды'], source:'https://wiki.blackrussia.online/'}
          ]
        },
        {
          id: 'transport-cmd', title: 'Транспорт', summary: 'Команды транспорта и гаража',
          items: [
            {title:'/car', meta:'Личный транспорт', text:'Быстрый доступ к управлению транспортом, поиску на карте и загрузке автомобиля.', tags:['/car','транспорт'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/64-transport-management-system/'},
            {title:'/garage', meta:'Гараж', text:'Панель управления гаражом и отдельные действия с транспортом.', tags:['/garage','гараж'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/64-transport-management-system/'}
          ]
        },
        {
          id: 'property-cmd', title: 'Недвижимость', summary: 'Дом, квартира и бизнес',
          items: [
            {title:'/home', meta:'Дом или квартира', text:'Команда для управления своим жильём.', tags:['/home','дом','квартира'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/41-property-purchase/'},
            {title:'/business', meta:'Собственный бизнес', text:'Открывает меню владельца бизнеса.', tags:['/business','бизнес'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/90-business-management/'}
          ]
        },
        {
          id: 'security-cmd', title: 'Безопасность', summary: 'Команды и разделы защиты',
          items: [
            {title:'Настройки безопасности', meta:'/mm → безопасность', text:'Привязка аккаунта, проверка устройств и часть действий по защите выполняются через игровое меню.', tags:['безопасность','привязка','настройки'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/122-%D0%BF%D1%80%D0%B8%D0%B2%D1%8F%D0%B7%D0%BA%D0%B0-%D0%B0%D0%BA%D0%BA%D0%B0%D1%83%D0%BD%D1%82%D0%B0/'}
          ]
        }
      ]
    },
    {
      id: 'items',
      icon: '🎒',
      image: 'assets/images/kb-accessories.png',
      title: 'Предметы и аксессуары',
      subtitle: 'Рюкзаки, сумки, кейсы и аксессуары',
      description: 'Каталог предметов с карточками, фильтрами и возможностью выводить цену, способ получения и характеристики.',
      source: 'https://wiki.blackrussia.online/',
      subsections: [
        {
          id: 'bags', title: 'Рюкзаки и сумки', summary: 'Переносимые предметы',
          items: [
            {title:'Каталог рюкзаков', meta:'Фото • вместимость • цена', text:'Раздел под карточки рюкзаков с изображением, параметрами и способом получения.', tags:['рюкзак','сумка','предмет'], source:'https://wiki.blackrussia.online/'},
            {title:'Сумки', meta:'Варианты • характеристики', text:'Подраздел для сумок и похожих аксессуаров.', tags:['сумка','аксессуар'], source:'https://wiki.blackrussia.online/'}
          ]
        },
        {
          id: 'cases', title: 'Кейсы', summary: 'Коллекционные и игровые кейсы',
          items: [
            {title:'Кейсы', meta:'Тип • получение', text:'Карточки кейсов с указанием типа, содержимого и условий получения.', tags:['кейс','получение'], source:'https://wiki.blackrussia.online/'}
          ]
        },
        {
          id: 'accessories', title: 'Аксессуары', summary: 'Очки, шапки и косметика',
          items: [
            {title:'Аксессуары', meta:'Внешний вид • описание', text:'Блок под косметические предметы и аксессуары персонажа с изображениями.', tags:['аксессуар','очки','шапка'], source:'https://wiki.blackrussia.online/'}
          ]
        }
      ]
    },
    {
      id: 'terms',
      icon: '📖',
      title: 'Термины и сокращения',
      subtitle: 'RP, игровые и форумные обозначения',
      description: 'Нормальный словарь сокращений с быстрым поиском, расшифровкой и коротким объяснением на человеческом языке.',
      source: 'https://wiki.blackrussia.online/',
      subsections: [
        {
          id: 'rp', title: 'RP-термины', summary: 'Базовые игровые понятия',
          items: [
            {title:'RP', meta:'Role Play', text:'Ролевая игра: отыгрыш персонажа и соблюдение логики игрового мира.', tags:['rp','ролеплей'], source:'https://wiki.blackrussia.online/'},
            {title:'MG', meta:'Metagaming', text:'Использование внеигровой информации в игровой ситуации.', tags:['mg','термин'], source:'https://wiki.blackrussia.online/'},
            {title:'DM', meta:'Deathmatch', text:'Нанесение урона или убийство без адекватной ролевой причины.', tags:['dm','термин'], source:'https://wiki.blackrussia.online/'},
            {title:'DB / SK / TK', meta:'Частые нарушения', text:'Отдельные карточки под популярные сокращения нарушений и примеры ситуаций.', tags:['db','sk','tk'], source:'https://wiki.blackrussia.online/'}
          ]
        },
        {
          id: 'forum', title: 'Форумные обозначения', summary: 'Для жалоб, заявок и тем',
          items: [
            {title:'Оформление обращений', meta:'Форум • шаблоны', text:'Раздел под условные обозначения, используемые в жалобах, заявлениях и темах форума.', tags:['форум','жалоба','заявка'], source:'https://forum.blackrussia.online/'}
          ]
        },
        {
          id: 'admin-terms', title: 'Административные термины', summary: 'Внутренние игровые обозначения',
          items: [
            {title:'Сокращения администрации', meta:'ГА • ЗГА • куратор', text:'Простой справочник по ролям и сокращениям, чтобы игроки понимали, кто за что отвечает.', tags:['га','зга','куратор'], source:'https://forum.blackrussia.online/'}
          ]
        }
      ]
    },
    {
      id: 'tech',
      icon: '🧑‍💻',
      title: 'Технический состав',
      subtitle: 'Техспециалисты, кураторы и помощники',
      description: 'Раздел про ТС с нормальным разбиением на роли, историю и полезные официальные темы.',
      source: 'https://forum.blackrussia.online/',
      subsections: [
        {
          id: 'current-tech', title: 'Действующий состав', summary: 'Кто сейчас в ТС',
          items: [
            {title:'Техспециалисты', meta:'Список • должность', text:'Подраздел для вывода актуального состава техспециалистов по направлениям и их статуса.', tags:['тс','техспециалист','состав'], source:'https://forum.blackrussia.online/'},
            {title:'Кураторы', meta:'Роли • руководство', text:'Отдельные карточки для кураторов и ответственных по направлениям.', tags:['куратор','руководство'], source:'https://forum.blackrussia.online/'},
            {title:'Помощники', meta:'Ассистенты • направление', text:'Подраздел под помощников и младшие технические роли.', tags:['помощник','тех'], source:'https://forum.blackrussia.online/'}
          ]
        },
        {
          id: 'history-tech', title: 'История ТС', summary: 'Бывший состав и периоды',
          items: [
            {title:'История руководства', meta:'Архив • периоды', text:'Блок под архив руководства технических специалистов и прошлых назначений.', tags:['история','тс','архив'], source:'https://forum.blackrussia.online/'}
          ]
        },
        {
          id: 'topics-tech', title: 'Полезные темы', summary: 'Форумные материалы по ТС',
          items: [
            {title:'Список действующих технических специалистов', meta:'Форумная тема', text:'Отдельная официальная тема со списком действующих специалистов может быть вынесена прямо в этот раздел как быстрый вход.', tags:['форум','тс','список'], source:'https://forum.blackrussia.online/'},
            {title:'История руководства технических специалистов', meta:'Форумная тема', text:'Архивная тема с руководством технического состава и изменениями.', tags:['форум','история','руководство'], source:'https://forum.blackrussia.online/'}
          ]
        }
      ]
    },
    {
      id: 'testing',
      icon: '🧪',
      title: 'Тестирование',
      subtitle: 'ЗБТ, тестировщики и участие',
      description: 'Не пустая заглушка, а полноценный раздел про TESTHUB, участие в ЗБТ, награды и типовые вопросы.',
      source: 'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/119-testhub-%D0%B7%D0%B1%D1%82/?p=ios',
      subsections: [
        {
          id: 'testhub', title: 'TESTHUB и ЗБТ', summary: 'Что это такое',
          items: [
            {title:'Что такое TESTHUB ЗБТ', meta:'Android • iOS', text:'Официальный центр помощи указывает, что закрытое бета-тестирование доступно на Android и iOS.', tags:['testhub','збт','android','ios'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/119-testhub-%D0%B7%D0%B1%D1%82/?p=ios'},
            {title:'Как подать заявку', meta:'Telegram • бот', text:'Заявки на участие в ЗБТ принимаются TESTHUB-ботом; игровой аккаунт должен быть привязан к Telegram.', tags:['заявка','бот','telegram'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/119-testhub-%D0%B7%D0%B1%D1%82/?p=ios'}
          ]
        },
        {
          id: 'rewards', title: 'Награды', summary: 'Что дают за найденные баги',
          items: [
            {title:'Награда за баги', meta:'BC • серьёзность бага', text:'Официальная справка говорит, что за найденные баги после завершения версии ЗБТ могут выдаваться BC, а сумма зависит от серьёзности бага.', tags:['награда','bc','баг'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/119-testhub-%D0%B7%D0%B1%D1%82/?p=ios'}
          ]
        },
        {
          id: 'faq-test', title: 'FAQ', summary: 'Частые вопросы',
          items: [
            {title:'Почему не одобрили заявку', meta:'Критерии отбора', text:'Официально критерии отбора не раскрываются; если заявка не прошла, можно подать её повторно позже.', tags:['критерии','заявка','отказ'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/119-testhub-%D0%B7%D0%B1%D1%82/?p=ios'},
            {title:'Можно ли стать администратором на ЗБТ', meta:'FAQ', text:'Справка отдельно отвечает, что в настоящее время такая возможность не рассматривается.', tags:['администратор','збт'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/119-testhub-%D0%B7%D0%B1%D1%82/?p=ios'}
          ]
        }
      ]
    },
    {
      id: 'security',
      icon: '🔐',
      title: 'Безопасность аккаунта',
      subtitle: 'Защита, взлом и восстановление',
      description: 'Подробный раздел по защите аккаунта без воды: привязка, коды, подозрительный вход, выход со всех устройств и обращение в поддержку.',
      source: 'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/',
      subsections: [
        {
          id: 'protection', title: 'Базовая защита', summary: 'Как не потерять аккаунт',
          items: [
            {title:'Не передавай коды', meta:'Почта • подтверждение', text:'Код подтверждения с почты нельзя сообщать никому — это одно из базовых правил защиты аккаунта.', tags:['код','почта','защита'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/242-%D0%BA%D0%B0%D0%BA-%D0%B2%D1%8B%D0%B9%D1%82%D0%B8-%D1%81%D0%BE-%D0%B2%D1%81%D0%B5%D1%85-%D1%83%D1%81%D1%82%D1%80%D0%BE%D0%B8%D1%81%D1%82%D0%B2/'},
            {title:'Привяжи аккаунт', meta:'E-mail • соцсети', text:'Привязка аккаунта через /mm повышает шанс восстановить доступ и закрепить прогресс.', tags:['привязка','аккаунт','/mm'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/122-%D0%BF%D1%80%D0%B8%D0%B2%D1%8F%D0%B7%D0%BA%D0%B0-%D0%B0%D0%BA%D0%BA%D0%B0%D1%83%D0%BD%D1%82%D0%B0/'}
          ]
        },
        {
          id: 'hacked', title: 'Если взломали', summary: 'Первые действия',
          items: [
            {title:'Выйти со всех устройств', meta:'Подозрительный вход', text:'Если есть подозрение на чужой доступ, первым делом нужно завершить все активные сессии.', tags:['взлом','устройства','сессии'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/242-%D0%BA%D0%B0%D0%BA-%D0%B2%D1%8B%D0%B9%D1%82%D0%B8-%D1%81%D0%BE-%D0%B2%D1%81%D0%B5%D1%85-%D1%83%D1%81%D1%82%D1%80%D0%BE%D0%B8%D1%81%D1%82%D0%B2/'},
            {title:'Сменить пароль и проверить привязки', meta:'Пароль • VK • Telegram', text:'После выхода со всех устройств стоит сразу сменить пароль и проверить привязанные сервисы.', tags:['пароль','vk','telegram'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/242-%D0%BA%D0%B0%D0%BA-%D0%B2%D1%8B%D0%B9%D1%82%D0%B8-%D1%81%D0%BE-%D0%B2%D1%81%D0%B5%D1%85-%D1%83%D1%81%D1%82%D1%80%D0%BE%D0%B8%D1%81%D1%82%D0%B2/'}
          ]
        },
        {
          id: 'support-sec', title: 'Восстановление и поддержка', summary: 'Куда писать и что прикладывать',
          items: [
            {title:'Обращение в поддержку', meta:'Взлом • имущество • доступ', text:'Через официальный центр помощи можно обращаться по вопросам взлома, пропажи имущества и восстановления доступа.', tags:['поддержка','восстановление','имущество'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/120-%D0%BA%D0%B0%D0%BA-%D1%81%D0%B2%D1%8F%D0%B7%D0%B0%D1%82%D1%8C%D1%81%D1%8F-%D1%81-%D0%BF%D0%BE%D0%B4%D0%B4%D0%B5%D1%80%D0%B6%D0%BA%D0%BE%D0%B8-br/'},
            {title:'Памятка для обращения', meta:'Скриншоты • описание', text:'В разделе удобно хранить чеклист: ник, сервер, описание проблемы, дата, скриншоты, чеки оплаты и всё, что ускорит разбор.', tags:['тикет','поддержка','чеклист'], source:'https://blackhubgames.helpshift.com/hc/ru/3-black-russia/faq/120-%D0%BA%D0%B0%D0%BA-%D1%81%D0%B2%D1%8F%D0%B7%D0%B0%D1%82%D1%8C%D1%81%D1%8F-%D1%81-%D0%BF%D0%BE%D0%B4%D0%B4%D0%B5%D1%80%D0%B6%D0%BA%D0%BE%D0%B8-br/'}
          ]
        }
      ]
    },
    {
      id: 'trades',
      icon: '🤝',
      title: 'Безопасные сделки',
      subtitle: 'Авто, дома, бизнесы и имущество',
      description: 'Доведённый до ума раздел про сделки: отдельные сценарии, красные флаги, памятка до и после обмена.',
      source: 'https://forum.blackrussia.online/',
      subsections: [
        {
          id: 'before', title: 'Перед сделкой', summary: 'Что проверить до передачи',
          items: [
            {title:'Проверка предмета сделки', meta:'Авто • дом • бизнес', text:'Перед любой передачей денег убедись, что в окне сделки указан нужный объект, верная сумма и нет лишних условий.', tags:['сделка','проверка','сумма'], source:'https://forum.blackrussia.online/'},
            {title:'Не спеши подтверждать', meta:'Пауза • сверка', text:'Сначала перечитай условия, перепроверь ник и объект, и только потом подтверждай операцию.', tags:['подтверждение','внимательность'], source:'https://forum.blackrussia.online/'}
          ]
        },
        {
          id: 'vehicle-deals', title: 'Сделки с авто', summary: 'Покупка и продажа транспорта',
          items: [
            {title:'Автомобиль', meta:'ID • модель • цена', text:'Проверь модель, визуальный вид, договорённую цену и все детали до финального подтверждения.', tags:['авто','машина','сделка'], source:'https://forum.blackrussia.online/'}
          ]
        },
        {
          id: 'property-deals', title: 'Сделки с недвижимостью', summary: 'Дом, квартира, гараж',
          items: [
            {title:'Недвижимость', meta:'Локация • тип • цена', text:'Сверь адрес или расположение, тип объекта и точную сумму сделки.', tags:['дом','квартира','гараж'], source:'https://forum.blackrussia.online/'}
          ]
        },
        {
          id: 'after', title: 'После сделки', summary: 'Контроль результата',
          items: [
            {title:'Сразу после завершения', meta:'Проверка владения', text:'После сделки проверь, что имущество действительно перешло, деньги списались корректно, а объект отображается в твоём интерфейсе.', tags:['после','проверка','владение'], source:'https://forum.blackrussia.online/'},
            {title:'Если возникла проблема', meta:'Скриншоты • поддержка', text:'Сразу сохрани доказательства: скриншоты, переписку, данные второго игрока, дату и условия сделки.', tags:['проблема','скриншот','доказательства'], source:'https://forum.blackrussia.online/'}
          ]
        }
      ]
    }
  ]
};
