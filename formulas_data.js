// ============================================================
// PetroLearn — справочник формул
// Каждая формула: LaTeX-запись, переменные с единицами,
// область применимости и источник.
// ============================================================

const formulaCategories = [
    { id: 'rock',       name: 'Физика пласта' },
    { id: 'pvt',        name: 'Пластовые флюиды (PVT)' },
    { id: 'inflow',     name: 'Приток к скважине' },
    { id: 'reserves',   name: 'Запасы и прогноз добычи' },
    { id: 'waterflood', name: 'Разработка и заводнение' },
    { id: 'hydraulics', name: 'Гидравлика и техника' }
];

const formulasData = [
    // ================= ФИЗИКА ПЛАСТА =================
    {
        id: 'porosity',
        category: 'rock',
        title: 'Коэффициент пористости',
        latex: 'm = \\dfrac{V_{\\text{пор}}}{V_{\\text{обр}}}',
        variables: [
            { symbol: 'm', name: 'коэффициент открытой пористости', units: 'доли ед.' },
            { symbol: 'V_{\\text{пор}}', name: 'объём пор образца', units: 'м³' },
            { symbol: 'V_{\\text{обр}}', name: 'общий объём образца породы', units: 'м³' }
        ],
        note: 'Типичные значения для терригенных коллекторов — 0,15–0,25; для карбонатных — 0,05–0,15.',
        source: 'Гиматудинов Ш.К. Физика нефтяного и газового пласта'
    },
    {
        id: 'saturation-balance',
        category: 'rock',
        title: 'Баланс насыщенностей',
        latex: 'S_{\\text{н}} + S_{\\text{в}} + S_{\\text{г}} = 1',
        variables: [
            { symbol: 'S_{\\text{н}}', name: 'нефтенасыщенность', units: 'доли ед.' },
            { symbol: 'S_{\\text{в}}', name: 'водонасыщенность', units: 'доли ед.' },
            { symbol: 'S_{\\text{г}}', name: 'газонасыщенность', units: 'доли ед.' }
        ],
        note: 'Сумма насыщенностей порового пространства всеми флюидами всегда равна единице.',
        source: 'Гиматудинов Ш.К. Физика нефтяного и газового пласта'
    },
    {
        id: 'darcy-linear',
        category: 'rock',
        title: 'Закон Дарси (линейная фильтрация)',
        latex: 'Q = \\dfrac{k \\, F}{\\mu} \\cdot \\dfrac{\\Delta P}{L}',
        variables: [
            { symbol: 'Q', name: 'объёмный расход флюида', units: 'м³/с' },
            { symbol: 'k', name: 'проницаемость породы', units: 'м² (1 Д ≈ 1,02·10⁻¹² м²)' },
            { symbol: 'F', name: 'площадь поперечного сечения', units: 'м²' },
            { symbol: '\\mu', name: 'динамическая вязкость флюида', units: 'Па·с' },
            { symbol: '\\Delta P', name: 'перепад давления', units: 'Па' },
            { symbol: 'L', name: 'длина пути фильтрации', units: 'м' }
        ],
        note: 'Справедлив для ламинарной фильтрации однофазной несжимаемой жидкости (Re < 1).',
        source: 'Darcy H. (1856); Басниев К.С. Подземная гидромеханика'
    },
    {
        id: 'dupuit',
        category: 'rock',
        title: 'Формула Дюпюи (плоскорадиальный приток)',
        latex: 'Q = \\dfrac{2 \\pi k h \\,(P_{\\text{пл}} - P_{\\text{заб}})}{\\mu \\, \\ln\\dfrac{R_{\\text{к}}}{r_{\\text{с}}}}',
        variables: [
            { symbol: 'Q', name: 'дебит скважины', units: 'м³/с' },
            { symbol: 'k', name: 'проницаемость пласта', units: 'м²' },
            { symbol: 'h', name: 'эффективная толщина пласта', units: 'м' },
            { symbol: 'P_{\\text{пл}}', name: 'пластовое давление на контуре питания', units: 'Па' },
            { symbol: 'P_{\\text{заб}}', name: 'забойное давление', units: 'Па' },
            { symbol: '\\mu', name: 'динамическая вязкость', units: 'Па·с' },
            { symbol: 'R_{\\text{к}}', name: 'радиус контура питания', units: 'м' },
            { symbol: 'r_{\\text{с}}', name: 'радиус скважины', units: 'м' }
        ],
        note: 'Установившийся плоскорадиальный приток несжимаемой жидкости к совершенной скважине.',
        source: 'Dupuit J. (1863); Басниев К.С. Подземная гидромеханика',
        calcLink: { href: 'calculators.html#calc-card-darcy', label: 'Рассчитать дебит' }
    },
    {
        id: 'dupuit-skin',
        category: 'rock',
        title: 'Приток с учётом скин-фактора',
        latex: 'Q = \\dfrac{2 \\pi k h \\,(P_{\\text{пл}} - P_{\\text{заб}})}{\\mu \\left( \\ln\\dfrac{R_{\\text{к}}}{r_{\\text{с}}} + S \\right)}',
        variables: [
            { symbol: 'S', name: 'скин-фактор (безразмерный)', units: '—' },
            { symbol: 'Q, k, h, \\mu', name: 'то же, что в формуле Дюпюи', units: 'СИ' }
        ],
        note: 'S > 0 — призабойная зона загрязнена; S < 0 — зона улучшена (кислотная обработка, ГРП).',
        source: 'van Everdingen A.F., Hurst W. (1949)'
    },
    {
        id: 'skin-radius',
        category: 'rock',
        title: 'Приведённый радиус скважины',
        latex: 'r_{\\text{пр}} = r_{\\text{с}} \\, e^{-S}',
        variables: [
            { symbol: 'r_{\\text{пр}}', name: 'приведённый (эффективный) радиус', units: 'м' },
            { symbol: 'r_{\\text{с}}', name: 'фактический радиус скважины', units: 'м' },
            { symbol: 'S', name: 'скин-фактор', units: '—' }
        ],
        note: 'Радиус идеальной скважины, работающей с той же продуктивностью, что и реальная со скином.',
        source: 'Dake L.P. Fundamentals of Reservoir Engineering'
    },
    {
        id: 'perm-layered',
        category: 'rock',
        title: 'Средняя проницаемость слоистого пласта',
        latex: '\\bar{k} = \\dfrac{\\sum k_i h_i}{\\sum h_i}',
        variables: [
            { symbol: '\\bar{k}', name: 'средняя проницаемость', units: 'м²' },
            { symbol: 'k_i', name: 'проницаемость i-го пропластка', units: 'м²' },
            { symbol: 'h_i', name: 'толщина i-го пропластка', units: 'м' }
        ],
        note: 'Среднеарифметическое взвешивание — для параллельной работы пропластков (поток вдоль напластования).',
        source: 'Басниев К.С. Подземная гидромеханика'
    },
    {
        id: 'perm-serial',
        category: 'rock',
        title: 'Средняя проницаемость зонально-неоднородного пласта',
        latex: '\\bar{k} = \\dfrac{L}{\\sum \\dfrac{L_i}{k_i}}',
        variables: [
            { symbol: 'L', name: 'общая длина пути фильтрации', units: 'м' },
            { symbol: 'L_i', name: 'длина i-й зоны', units: 'м' },
            { symbol: 'k_i', name: 'проницаемость i-й зоны', units: 'м²' }
        ],
        note: 'Среднегармоническое взвешивание — для последовательной фильтрации через зоны разной проницаемости.',
        source: 'Басниев К.С. Подземная гидромеханика'
    },
    {
        id: 'piezoconductivity',
        category: 'rock',
        title: 'Коэффициент пьезопроводности',
        latex: '\\varkappa = \\dfrac{k}{\\mu \\,(m \\beta_{\\text{ж}} + \\beta_{\\text{с}})}',
        variables: [
            { symbol: '\\varkappa', name: 'коэффициент пьезопроводности', units: 'м²/с' },
            { symbol: 'k', name: 'проницаемость', units: 'м²' },
            { symbol: '\\mu', name: 'вязкость флюида', units: 'Па·с' },
            { symbol: 'm', name: 'пористость', units: 'доли ед.' },
            { symbol: '\\beta_{\\text{ж}}', name: 'сжимаемость жидкости', units: '1/Па' },
            { symbol: '\\beta_{\\text{с}}', name: 'сжимаемость скелета породы', units: '1/Па' }
        ],
        note: 'Характеризует скорость перераспределения давления в пласте. Типичный порядок — 0,1–10 м²/с.',
        source: 'Щелкачев В.Н. Основы подземной гидравлики'
    },
    {
        id: 'diffusivity-eq',
        category: 'rock',
        title: 'Уравнение пьезопроводности (упругий режим)',
        latex: '\\dfrac{\\partial P}{\\partial t} = \\varkappa \\, \\nabla^2 P',
        variables: [
            { symbol: 'P', name: 'пластовое давление', units: 'Па' },
            { symbol: 't', name: 'время', units: 'с' },
            { symbol: '\\varkappa', name: 'коэффициент пьезопроводности', units: 'м²/с' }
        ],
        note: 'Базовое уравнение неустановившейся фильтрации упругой жидкости; основа интерпретации ГДИС (КВД/КПД).',
        source: 'Щелкачев В.Н. Основы подземной гидравлики'
    },

    // ================= PVT =================
    {
        id: 'real-gas',
        category: 'pvt',
        title: 'Уравнение состояния реального газа',
        latex: 'P V = z \\, n R T',
        variables: [
            { symbol: 'P', name: 'абсолютное давление', units: 'Па' },
            { symbol: 'V', name: 'объём газа', units: 'м³' },
            { symbol: 'z', name: 'коэффициент сверхсжимаемости', units: '—' },
            { symbol: 'n', name: 'количество вещества', units: 'моль' },
            { symbol: 'R', name: 'универсальная газовая постоянная', units: '8,314 Дж/(моль·К)' },
            { symbol: 'T', name: 'абсолютная температура', units: 'К' }
        ],
        note: 'Для идеального газа z = 1. Для пластовых условий z определяют по корреляции Стэндинга–Каца.',
        source: 'Standing M.B., Katz D.L. (1942)'
    },
    {
        id: 'pseudo-reduced',
        category: 'pvt',
        title: 'Псевдоприведённые параметры газа',
        latex: 'P_{\\text{пр}} = \\dfrac{P}{P_{\\text{пк}}}, \\qquad T_{\\text{пр}} = \\dfrac{T}{T_{\\text{пк}}}',
        variables: [
            { symbol: 'P_{\\text{пр}}, T_{\\text{пр}}', name: 'псевдоприведённые давление и температура', units: '—' },
            { symbol: 'P_{\\text{пк}}, T_{\\text{пк}}', name: 'псевдокритические давление и температура смеси', units: 'Па, К' }
        ],
        note: 'Входные параметры для определения z-фактора по диаграмме Стэндинга–Каца.',
        source: 'Standing M.B., Katz D.L. (1942)'
    },
    {
        id: 'bg',
        category: 'pvt',
        title: 'Объёмный коэффициент газа',
        latex: 'B_{\\text{г}} = \\dfrac{V_{\\text{пл}}}{V_{\\text{ст}}} = \\dfrac{P_{\\text{ст}} \\, z \\, T}{P \\, T_{\\text{ст}}}',
        variables: [
            { symbol: 'B_{\\text{г}}', name: 'объёмный коэффициент газа', units: 'м³/м³' },
            { symbol: 'P_{\\text{ст}}, T_{\\text{ст}}', name: 'стандартные давление и температура', units: '0,101325 МПа; 293 К' },
            { symbol: 'P, T', name: 'пластовые давление и температура', units: 'Па, К' },
            { symbol: 'z', name: 'коэффициент сверхсжимаемости при P, T', units: '—' }
        ],
        note: 'Показывает, во сколько раз объём газа в пласте меньше объёма при стандартных условиях (обычно Bг ≈ 0,003–0,01).',
        source: 'Dake L.P. Fundamentals of Reservoir Engineering'
    },
    {
        id: 'bo',
        category: 'pvt',
        title: 'Объёмный коэффициент нефти',
        latex: 'B_{\\text{о}} = \\dfrac{V_{\\text{пл}}}{V_{\\text{дег}}}',
        variables: [
            { symbol: 'B_{\\text{о}}', name: 'объёмный коэффициент нефти', units: 'м³/м³' },
            { symbol: 'V_{\\text{пл}}', name: 'объём нефти в пластовых условиях', units: 'м³' },
            { symbol: 'V_{\\text{дег}}', name: 'объём дегазированной нефти при ст. условиях', units: 'м³' }
        ],
        note: 'Всегда Bо ≥ 1 (обычно 1,1–1,8): в пласте нефть содержит растворённый газ и расширена. Пересчётный коэффициент θ = 1/Bо.',
        source: 'Мищенко И.Т. Скважинная добыча нефти'
    },
    {
        id: 'rs',
        category: 'pvt',
        title: 'Газосодержание пластовой нефти',
        latex: 'R_s = \\dfrac{V_{\\text{г.раств}}}{V_{\\text{н.дег}}}',
        variables: [
            { symbol: 'R_s', name: 'газосодержание (газовый фактор растворённого газа)', units: 'м³/м³' },
            { symbol: 'V_{\\text{г.раств}}', name: 'объём растворённого газа (при ст. условиях)', units: 'м³' },
            { symbol: 'V_{\\text{н.дег}}', name: 'объём дегазированной нефти', units: 'м³' }
        ],
        note: 'Растёт с давлением до давления насыщения, выше него — постоянно. Не путать с промысловым газовым фактором.',
        source: 'Мищенко И.Т. Скважинная добыча нефти'
    },
    {
        id: 'api',
        category: 'pvt',
        title: 'Плотность нефти в градусах API',
        latex: '\\gamma_{API} = \\dfrac{141{,}5}{\\gamma_{\\text{н}}} - 131{,}5',
        variables: [
            { symbol: '\\gamma_{API}', name: 'плотность в градусах API', units: '°API' },
            { symbol: '\\gamma_{\\text{н}}', name: 'относительная плотность нефти (к воде при 15,6 °C)', units: '—' }
        ],
        note: 'Лёгкая нефть — более 31,1 °API; средняя — 22,3–31,1; тяжёлая — менее 22,3 °API.',
        source: 'American Petroleum Institute',
        calcLink: { href: 'calculators.html#calc-card-api', label: 'Конвертер API' }
    },
    {
        id: 'compressibility',
        category: 'pvt',
        title: 'Коэффициент сжимаемости',
        latex: 'c = -\\dfrac{1}{V} \\left( \\dfrac{\\partial V}{\\partial P} \\right)_T',
        variables: [
            { symbol: 'c', name: 'коэффициент изотермической сжимаемости', units: '1/Па' },
            { symbol: 'V', name: 'объём флюида (или пор)', units: 'м³' },
            { symbol: 'P', name: 'давление', units: 'Па' }
        ],
        note: 'Типичные значения: нефть — (7–30)·10⁻¹⁰ 1/Па; вода — ~4,5·10⁻¹⁰ 1/Па; поры — (0,3–2)·10⁻¹⁰ 1/Па.',
        source: 'Dake L.P. Fundamentals of Reservoir Engineering'
    },
    {
        id: 'kinematic-viscosity',
        category: 'pvt',
        title: 'Кинематическая вязкость',
        latex: '\\nu = \\dfrac{\\mu}{\\rho}',
        variables: [
            { symbol: '\\nu', name: 'кинематическая вязкость', units: 'м²/с (1 сСт = 10⁻⁶ м²/с)' },
            { symbol: '\\mu', name: 'динамическая вязкость', units: 'Па·с (1 сП = 10⁻³ Па·с)' },
            { symbol: '\\rho', name: 'плотность флюида', units: 'кг/м³' }
        ],
        note: 'В пластовых расчётах чаще используется динамическая вязкость μ.',
        source: 'Гиматудинов Ш.К. Физика нефтяного и газового пласта'
    },

    // ================= ПРИТОК К СКВАЖИНЕ =================
    {
        id: 'productivity-index',
        category: 'inflow',
        title: 'Коэффициент продуктивности',
        latex: 'J = \\dfrac{Q}{P_{\\text{пл}} - P_{\\text{заб}}}',
        variables: [
            { symbol: 'J', name: 'коэффициент продуктивности', units: 'м³/(сут·МПа)' },
            { symbol: 'Q', name: 'дебит жидкости', units: 'м³/сут' },
            { symbol: 'P_{\\text{пл}} - P_{\\text{заб}}', name: 'депрессия на пласт', units: 'МПа' }
        ],
        note: 'Основной показатель добывных возможностей скважины; определяется по индикаторной диаграмме.',
        source: 'Мищенко И.Т. Скважинная добыча нефти'
    },
    {
        id: 'vogel',
        category: 'inflow',
        title: 'IPR-кривая Вогеля',
        latex: '\\dfrac{q}{q_{\\max}} = 1 - 0{,}2 \\dfrac{P_{\\text{заб}}}{P_{\\text{пл}}} - 0{,}8 \\left( \\dfrac{P_{\\text{заб}}}{P_{\\text{пл}}} \\right)^{2}',
        variables: [
            { symbol: 'q', name: 'дебит при забойном давлении Pзаб', units: 'м³/сут' },
            { symbol: 'q_{\\max}', name: 'максимальный дебит (при Pзаб = 0)', units: 'м³/сут' },
            { symbol: 'P_{\\text{заб}}', name: 'забойное давление', units: 'МПа' },
            { symbol: 'P_{\\text{пл}}', name: 'пластовое давление', units: 'МПа' }
        ],
        note: 'Для скважин, работающих при давлении ниже давления насыщения (режим растворённого газа), когда индикаторная линия нелинейна.',
        source: 'Vogel J.V. (SPE 1476, 1968)'
    },
    {
        id: 'gas-deliverability',
        category: 'inflow',
        title: 'Биномиальный закон притока газа',
        latex: 'P_{\\text{пл}}^{2} - P_{\\text{заб}}^{2} = A\\,q + B\\,q^{2}',
        variables: [
            { symbol: 'q', name: 'дебит газа', units: 'тыс. м³/сут' },
            { symbol: 'A', name: 'коэффициент фильтрационного сопротивления (линейный)', units: 'МПа²·сут/тыс. м³' },
            { symbol: 'B', name: 'коэффициент (инерционный, учёт нарушения з-на Дарси)', units: 'МПа²·(сут/тыс. м³)²' }
        ],
        note: 'Коэффициенты A и B определяются по результатам исследования скважины на нескольких режимах.',
        source: 'Коротаев Ю.П., Ширковский А.И. Добыча газа'
    },

    // ================= ЗАПАСЫ И ПРОГНОЗ =================
    {
        id: 'stooip',
        category: 'reserves',
        title: 'Объёмный метод подсчёта запасов нефти',
        latex: 'Q_{\\text{н}} = F \\, h \\, m \\, \\beta_{\\text{н}} \\, \\rho_{\\text{н}} \\, \\theta',
        variables: [
            { symbol: 'Q_{\\text{н}}', name: 'начальные геологические запасы нефти', units: 'т' },
            { symbol: 'F', name: 'площадь нефтеносности', units: 'м²' },
            { symbol: 'h', name: 'эффективная нефтенасыщенная толщина', units: 'м' },
            { symbol: 'm', name: 'коэффициент открытой пористости', units: 'доли ед.' },
            { symbol: '\\beta_{\\text{н}}', name: 'коэффициент нефтенасыщенности', units: 'доли ед.' },
            { symbol: '\\rho_{\\text{н}}', name: 'плотность нефти в поверхностных условиях', units: 'т/м³' },
            { symbol: '\\theta', name: 'пересчётный коэффициент, θ = 1/Bо', units: 'доли ед.' }
        ],
        note: 'Основной метод подсчёта геологических запасов в казахстанской и в целом постсоветской практике.',
        source: 'Инструкция по подсчёту запасов нефти и газа (ГКЗ)',
        calcLink: { href: 'calculators.html#calc-card-vol', label: 'Рассчитать запасы' }
    },
    {
        id: 'giip',
        category: 'reserves',
        title: 'Объёмный метод подсчёта запасов газа',
        latex: 'V_{\\text{г}} = \\dfrac{F \\, h \\, m \\, \\beta_{\\text{г}}}{B_{\\text{г}}}',
        variables: [
            { symbol: 'V_{\\text{г}}', name: 'начальные геологические запасы газа (ст. условия)', units: 'м³' },
            { symbol: 'F', name: 'площадь газоносности', units: 'м²' },
            { symbol: 'h', name: 'эффективная газонасыщенная толщина', units: 'м' },
            { symbol: 'm', name: 'пористость', units: 'доли ед.' },
            { symbol: '\\beta_{\\text{г}}', name: 'коэффициент газонасыщенности', units: 'доли ед.' },
            { symbol: 'B_{\\text{г}}', name: 'объёмный коэффициент газа при начальных P, T', units: 'м³/м³' }
        ],
        note: 'Эквивалентная запись через начальное давление: Vг = F·h·m·βг·(P Tст)/(Pст z T).',
        source: 'Инструкция по подсчёту запасов нефти и газа (ГКЗ)'
    },
    {
        id: 'recovery-factor',
        category: 'reserves',
        title: 'Коэффициент извлечения нефти (КИН)',
        latex: '\\eta = \\dfrac{Q_{\\text{извл}}}{Q_{\\text{геол}}} = K_{\\text{выт}} \\cdot K_{\\text{охв}}',
        variables: [
            { symbol: '\\eta', name: 'коэффициент извлечения нефти', units: 'доли ед.' },
            { symbol: 'Q_{\\text{извл}}', name: 'извлекаемые запасы (накопленная добыча за срок разработки)', units: 'т' },
            { symbol: 'Q_{\\text{геол}}', name: 'начальные геологические запасы', units: 'т' },
            { symbol: 'K_{\\text{выт}}', name: 'коэффициент вытеснения', units: 'доли ед.' },
            { symbol: 'K_{\\text{охв}}', name: 'коэффициент охвата пласта воздействием', units: 'доли ед.' }
        ],
        note: 'Средний КИН при заводнении — 0,3–0,45. Методы увеличения нефтеотдачи повышают Квыт и Кохв.',
        source: 'Желтов Ю.П. Разработка нефтяных месторождений'
    },
    {
        id: 'material-balance-gas',
        category: 'reserves',
        title: 'Материальный баланс газовой залежи (P/z-метод)',
        latex: '\\dfrac{P}{z} = \\dfrac{P_{\\text{н}}}{z_{\\text{н}}} \\left( 1 - \\dfrac{Q_{\\text{доб}}}{V_{\\text{г}}} \\right)',
        variables: [
            { symbol: 'P, z', name: 'текущие пластовое давление и z-фактор', units: 'Па, —' },
            { symbol: 'P_{\\text{н}}, z_{\\text{н}}', name: 'начальные пластовое давление и z-фактор', units: 'Па, —' },
            { symbol: 'Q_{\\text{доб}}', name: 'накопленная добыча газа', units: 'м³' },
            { symbol: 'V_{\\text{г}}', name: 'начальные запасы газа', units: 'м³' }
        ],
        note: 'Для газового режима зависимость P/z от накопленной добычи линейна — экстраполяция даёт запасы Vг.',
        source: 'Dake L.P. Fundamentals of Reservoir Engineering'
    },
    {
        id: 'material-balance-oil',
        category: 'reserves',
        title: 'Материальный баланс нефтяной залежи (упругий режим)',
        latex: 'N_p B_{\\text{о}} = N B_{\\text{он}} \\, c_{\\text{э}} \\, \\Delta P',
        variables: [
            { symbol: 'N_p', name: 'накопленная добыча нефти (ст. условия)', units: 'м³' },
            { symbol: 'N', name: 'начальные геологические запасы (ст. условия)', units: 'м³' },
            { symbol: 'B_{\\text{о}}, B_{\\text{он}}', name: 'текущий и начальный объёмные коэффициенты', units: 'м³/м³' },
            { symbol: 'c_{\\text{э}}', name: 'эффективная сжимаемость системы: (cнSн + cвSв + cп)/Sн', units: '1/Па' },
            { symbol: '\\Delta P', name: 'падение пластового давления', units: 'Па' }
        ],
        note: 'Применим выше давления насыщения (недонасыщенная залежь, упругий режим), без притока воды.',
        source: 'Craft B.C., Hawkins M.F. Applied Petroleum Reservoir Engineering'
    },
    {
        id: 'arps-exponential',
        category: 'reserves',
        title: 'Кривая падения Арпса (экспоненциальная)',
        latex: 'q(t) = q_{\\text{н}} \\, e^{-Dt}, \\qquad Q_{\\text{нак}} = \\dfrac{q_{\\text{н}} - q(t)}{D}',
        variables: [
            { symbol: 'q(t)', name: 'дебит в момент времени t', units: 'м³/сут' },
            { symbol: 'q_{\\text{н}}', name: 'начальный дебит', units: 'м³/сут' },
            { symbol: 'D', name: 'темп падения (константа)', units: '1/год' },
            { symbol: 'Q_{\\text{нак}}', name: 'накопленная добыча за время t', units: 'м³' }
        ],
        note: 'Частный случай кривых Арпса при b = 0. Наиболее консервативная оценка прогноза добычи.',
        source: 'Arps J.J. (1945)'
    },
    {
        id: 'arps-hyperbolic',
        category: 'reserves',
        title: 'Кривая падения Арпса (гиперболическая)',
        latex: 'q(t) = \\dfrac{q_{\\text{н}}}{\\left( 1 + b \\, D_{\\text{н}} \\, t \\right)^{1/b}}',
        variables: [
            { symbol: 'q_{\\text{н}}', name: 'начальный дебит', units: 'м³/сут' },
            { symbol: 'D_{\\text{н}}', name: 'начальный темп падения', units: '1/год' },
            { symbol: 'b', name: 'показатель гиперболичности (0 < b < 1)', units: '—' }
        ],
        note: 'При b = 0 переходит в экспоненциальную, при b = 1 — в гармоническую. b подбирается по фактической истории добычи.',
        source: 'Arps J.J. (1945)'
    },
    {
        id: 'production-rate',
        category: 'reserves',
        title: 'Темп отбора от НИЗ',
        latex: 'T_{\\text{отб}} = \\dfrac{q_{\\text{год}}}{Q_{\\text{НИЗ}}} \\cdot 100\\%',
        variables: [
            { symbol: 'T_{\\text{отб}}', name: 'темп отбора', units: '%/год' },
            { symbol: 'q_{\\text{год}}', name: 'годовая добыча нефти', units: 'т/год' },
            { symbol: 'Q_{\\text{НИЗ}}', name: 'начальные извлекаемые запасы', units: 'т' }
        ],
        note: 'На стадии максимальной добычи темп отбора обычно составляет 3–8 % от НИЗ в год.',
        source: 'Желтов Ю.П. Разработка нефтяных месторождений'
    },

    // ================= РАЗРАБОТКА И ЗАВОДНЕНИЕ =================
    {
        id: 'water-cut',
        category: 'waterflood',
        title: 'Обводнённость продукции',
        latex: 'n_{\\text{в}} = \\dfrac{q_{\\text{в}}}{q_{\\text{в}} + q_{\\text{н}}} \\cdot 100\\%',
        variables: [
            { symbol: 'n_{\\text{в}}', name: 'обводнённость', units: '%' },
            { symbol: 'q_{\\text{в}}', name: 'дебит воды', units: 'м³/сут' },
            { symbol: 'q_{\\text{н}}', name: 'дебит нефти', units: 'м³/сут' }
        ],
        note: 'Ключевой показатель стадии разработки. Предельная (экономическая) обводнённость — обычно 96–98 %.',
        source: 'Желтов Ю.П. Разработка нефтяных месторождений'
    },
    {
        id: 'mobility-ratio',
        category: 'waterflood',
        title: 'Соотношение подвижностей',
        latex: 'M = \\dfrac{k_{\\text{в}} / \\mu_{\\text{в}}}{k_{\\text{н}} / \\mu_{\\text{н}}}',
        variables: [
            { symbol: 'M', name: 'соотношение подвижностей вытесняющего агента и нефти', units: '—' },
            { symbol: 'k_{\\text{в}}, k_{\\text{н}}', name: 'фазовые проницаемости для воды и нефти', units: 'м²' },
            { symbol: '\\mu_{\\text{в}}, \\mu_{\\text{н}}', name: 'вязкости воды и нефти', units: 'Па·с' }
        ],
        note: 'При M ≤ 1 вытеснение устойчиво; при M > 1 возникают вязкостные языки и охват снижается. Полимерное заводнение снижает M.',
        source: 'Craig F.F. The Reservoir Engineering Aspects of Waterflooding'
    },
    {
        id: 'fractional-flow',
        category: 'waterflood',
        title: 'Доля воды в потоке (функция Баклея–Леверетта)',
        latex: 'f_{\\text{в}} = \\dfrac{1}{1 + \\dfrac{k_{\\text{н}}}{k_{\\text{в}}} \\cdot \\dfrac{\\mu_{\\text{в}}}{\\mu_{\\text{н}}}}',
        variables: [
            { symbol: 'f_{\\text{в}}', name: 'доля воды в фильтрационном потоке', units: 'доли ед.' },
            { symbol: 'k_{\\text{н}}, k_{\\text{в}}', name: 'фазовые проницаемости (функции водонасыщенности)', units: 'м²' },
            { symbol: '\\mu_{\\text{в}}, \\mu_{\\text{н}}', name: 'вязкости воды и нефти', units: 'Па·с' }
        ],
        note: 'Основа теории двухфазного вытеснения; без учёта капиллярных и гравитационных сил.',
        source: 'Buckley S.E., Leverett M.C. (1942)'
    },
    {
        id: 'injection-compensation',
        category: 'waterflood',
        title: 'Компенсация отборов закачкой',
        latex: 'K = \\dfrac{V_{\\text{зак}}}{V_{\\text{отб}}^{\\text{пл}}} \\cdot 100\\%',
        variables: [
            { symbol: 'K', name: 'текущая компенсация', units: '%' },
            { symbol: 'V_{\\text{зак}}', name: 'объём закачки за период', units: 'м³' },
            { symbol: 'V_{\\text{отб}}^{\\text{пл}}', name: 'отбор жидкости и газа в пластовых условиях', units: 'м³' }
        ],
        note: 'Отбор приводится к пластовым условиям через объёмные коэффициенты. K ≈ 100 % — стабилизация пластового давления.',
        source: 'Желтов Ю.П. Разработка нефтяных месторождений'
    },

    // ================= ГИДРАВЛИКА И ТЕХНИКА =================
    {
        id: 'hydrostatic',
        category: 'hydraulics',
        title: 'Гидростатическое давление столба жидкости',
        latex: 'P = \\rho \\, g \\, H',
        variables: [
            { symbol: 'P', name: 'гидростатическое давление', units: 'Па' },
            { symbol: '\\rho', name: 'плотность жидкости', units: 'кг/м³' },
            { symbol: 'g', name: 'ускорение свободного падения', units: '9,81 м/с²' },
            { symbol: 'H', name: 'высота столба жидкости (глубина по вертикали)', units: 'м' }
        ],
        note: 'Практическое правило: столб пресной воды создаёт ≈ 0,0098 МПа на каждый метр глубины.',
        source: 'Мищенко И.Т. Скважинная добыча нефти'
    },
    {
        id: 'reynolds',
        category: 'hydraulics',
        title: 'Число Рейнольдса для течения в трубе',
        latex: 'Re = \\dfrac{\\rho \\, v \\, d}{\\mu}',
        variables: [
            { symbol: 'Re', name: 'число Рейнольдса', units: '—' },
            { symbol: '\\rho', name: 'плотность жидкости', units: 'кг/м³' },
            { symbol: 'v', name: 'средняя скорость потока', units: 'м/с' },
            { symbol: 'd', name: 'внутренний диаметр трубы', units: 'м' },
            { symbol: '\\mu', name: 'динамическая вязкость', units: 'Па·с' }
        ],
        note: 'Re < 2300 — ламинарный режим; Re > 4000 — турбулентный; между ними — переходная зона.',
        source: 'Идельчик И.Е. Справочник по гидравлическим сопротивлениям'
    },
    {
        id: 'darcy-weisbach',
        category: 'hydraulics',
        title: 'Потери давления на трение (Дарси–Вейсбах)',
        latex: '\\Delta P = \\lambda \\, \\dfrac{L}{d} \\cdot \\dfrac{\\rho v^{2}}{2}',
        variables: [
            { symbol: '\\Delta P', name: 'потери давления на трение', units: 'Па' },
            { symbol: '\\lambda', name: 'коэффициент гидравлического сопротивления', units: '—' },
            { symbol: 'L', name: 'длина трубопровода', units: 'м' },
            { symbol: 'd', name: 'внутренний диаметр', units: 'м' },
            { symbol: 'v', name: 'средняя скорость потока', units: 'м/с' },
            { symbol: '\\rho', name: 'плотность жидкости', units: 'кг/м³' }
        ],
        note: 'Для ламинарного режима λ = 64/Re; для турбулентного λ определяется по формулам Блазиуса, Альтшуля и др.',
        source: 'Идельчик И.Е. Справочник по гидравлическим сопротивлениям'
    },
    {
        id: 'filtration-velocity',
        category: 'hydraulics',
        title: 'Скорость фильтрации',
        latex: 'v = \\dfrac{Q}{F}',
        variables: [
            { symbol: 'v', name: 'скорость фильтрации (фиктивная)', units: 'м/с' },
            { symbol: 'Q', name: 'объёмный расход', units: 'м³/с' },
            { symbol: 'F', name: 'полная площадь поперечного сечения породы', units: 'м²' }
        ],
        note: 'Истинная скорость движения флюида в порах выше: vист = v/m, где m — пористость.',
        source: 'Басниев К.С. Подземная гидромеханика'
    }
];
