import { createI18n } from "vue-i18n";
import { updateSEO } from "@/utils/seoUtils";

/**
 * Массив поддерживаемых языковых локалей в приложении
 * - "de" - немецкий
 * - "ru" - русский
 * - "en" - английский
 *
 * Используется `as const` для создания readonly tuple типа,
 * что позволяет TypeScript точно знать все возможные значения
 */
export const SUPPORT_LOCALES = ["de", "ru", "en"] as const;

/**
 * Тип для доступных локалей, извлекаемый из массива SUPPORT_LOCALES
 * Это union тип: "de" | "ru" | "en"
 * Обеспечивает типобезопасность при работе с локалями
 */
export type AvailableLocale = (typeof SUPPORT_LOCALES)[number];

/**
 * Локаль по умолчанию для приложения
 * Установлена немецкая локаль как основная
 */
export const DEFAULT_LOCALE: AvailableLocale = "de";

/**
 * Ключ, под которым выбранная локаль хранится в localStorage
 *
 * TODO: Перенести все операции с локальным хранилищем (чтение, запись
 * и сам ключ) в отдельную утилиту, например `src/utils/storageUtils.ts`,
 * чтобы модуль i18n не зависел от деталей работы с localStorage
 */
const LOCALE_STORAGE_KEY = "locale";

/**
 * Проверяет, является ли переданная строка валидным кодом языка
 *
 * @param code - строка для проверки
 * @returns true, если code является одним из SUPPORT_LOCALES
 */
export const isValidLocale = (code: string): code is AvailableLocale => {
  return SUPPORT_LOCALES.includes(code as AvailableLocale);
};

/**
 * Создание экземпляра Vue I18n для интернационализации
 *
 * Конфигурация:
 * - legacy: false - использует Composition API вместо старого API
 * - locale: DEFAULT_LOCALE - устанавливает текущую локаль
 * - fallbackLocale: DEFAULT_LOCALE - локаль для отката при отсутствии переводов
 * - messages: {} - изначально пустой объект, переводы загружаются динамически
 * - globalInjection: true - делает $t функцию доступной глобально в шаблонах
 */
const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages: {}, // изначально пусто
  globalInjection: true,
});

/**
 * Асинхронная функция для загрузки сообщений локализации
 *
 * @param locale - локаль для загрузки (de, ru, en)
 *
 * Выполняет:
 * 1. Динамический импорт JSON файла с переводами из папки ./locales/
 * 2. Регистрацию загруженных сообщений в глобальном экземпляре i18n
 *
 * Используется динамический импорт для code splitting -
 * переводы загружаются только когда нужны, а не все сразу
 */
export const loadLocaleMessages = async (
  locale: AvailableLocale,
): Promise<void> => {
  const messages = await import(`./locales/${locale}.json`);
  i18n.global.setLocaleMessage(locale, messages.default);
};

/**
 * Асинхронная функция для установки новой локали
 *
 * @param locale - локаль для установки
 *
 * Алгоритм работы:
 * 1. Проверяет, загружена ли уже локаль в i18n
 * 2. Если не загружена - загружает переводы через loadLocaleMessages
 * 3. Устанавливает новую активную локаль в i18n
 * 4. Сохраняет выбор пользователя в localStorage для персистентности
 *    (если хранилище недоступно, ошибка логируется и не прерывает смену языка)
 * 5. Обновляет SEO атрибуты
 *
 * Это обеспечивает ленивую загрузку переводов и сохранение настроек между сессиями
 */
export const setLocale = async (locale: AvailableLocale): Promise<void> => {
  if (!i18n.global.availableLocales.includes(locale)) {
    await loadLocaleMessages(locale);
  }
  i18n.global.locale.value = locale;

  // Сохраняет выбор пользователя в localStorage
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch (error) {
    // Хранилище может быть недоступно (приватный режим, запрет в настройках
    // браузера, переполнение квоты). Язык всё равно переключён, просто
    // выбор не будет запомнен между сессиями
    console.warn("Не удалось сохранить локаль в localStorage:", error);
  }

  // Обновляет SEO теги и атрибут lang в <html>
  await updateSEO();
};

/**
 * Возвращает следующую локаль из списка SUPPORT_LOCALES
 * с учётом циклического перехода (после последней идёт первая).
 *
 * Алгоритм:
 * 1. Находим индекс текущей локали
 * 2. Прибавляем 1 и берём остаток от деления на длину массива
 * 3. Возвращаем локаль по новому индексу
 */
export const getNextLocale = (): AvailableLocale => {
  // Вычисляем индекс следующей локали в массиве SUPPORT_LOCALES
  const newLocaleIndex: number =
    // Получаем индекс текущей локали в массиве SUPPORT_LOCALES
    (SUPPORT_LOCALES.indexOf(i18n.global.locale.value as AvailableLocale) +
      // Увеличиваем индекс на 1 для перехода к следующей локали
      1) %
    // Модульное деление для циклического перехода
    SUPPORT_LOCALES.length;

  // Получаем новую локаль по вычисленному индексу
  return SUPPORT_LOCALES[newLocaleIndex] as AvailableLocale;
};

/**
 * Переключает активную локаль на следующую из списка SUPPORT_LOCALES.
 *
 * Используется для кнопки/триггера смены языка.
 *
 * Пример последовательности: de → ru → en → de → ...
 */
export const switchLocale = async (): Promise<void> => {
  // Устанавливаем новую локаль
  await setLocale(getNextLocale());
};

/**
 * Возвращает предпочтительную локаль браузера, если она поддерживается.
 * Если предпочтительная локаль не поддерживается, возвращает локаль по умолчанию.
 */
export const getPrimaryNavigatorLocale = (): AvailableLocale => {
  // Получаем язык браузера, например "en" или "ru".
  const navigatorLocale = navigator.language.split("-")[0]?.toLowerCase() ?? "";
  // Проверяем, поддерживается ли локаль браузера в приложении
  return isValidLocale(navigatorLocale) ? navigatorLocale : DEFAULT_LOCALE;
};

/**
 * Возвращает локаль, сохранённую в localStorage, если она есть и валидна.
 * Если локаль не найдена, не поддерживается или localStorage недоступен,
 * возвращает null.
 *
 * Используется для восстановления настроек пользователя при повторном посещении сайта.
 */
export const getLocaleFromLocalStorage = (): AvailableLocale | null => {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    return saved && isValidLocale(saved) ? saved : null;
  } catch (error) {
    // Доступ к localStorage может быть запрещён (SecurityError),
    // в этом случае просто считаем, что сохранённой локали нет
    console.warn("Не удалось прочитать локаль из localStorage:", error);
    return null;
  }
};

/**
 * Определяет начальную локаль приложения при старте.
 *
 * Приоритет выбора:
 * 1. Сохранённый выбор пользователя в localStorage (только если он валиден)
 * 2. Предпочтительный язык браузера (если поддерживается)
 * 3. Локаль по умолчанию (DEFAULT_LOCALE)
 */
export const getInitialLocale = (): AvailableLocale => {
  return getLocaleFromLocalStorage() ?? getPrimaryNavigatorLocale();
};

/**
 * Инициализирует локаль приложения при старте:
 * определяет начальную локаль и применяет её через setLocale
 * (загрузка переводов, сохранение выбора, обновление атрибута lang).
 *
 * Возвращает Promise, после выполнения которого безопасно монтировать приложение.
 */
export const initLocale = async (): Promise<void> => {
  await setLocale(getInitialLocale());
};

/**
 * Экспорт экземпляра i18n как модуль по умолчанию
 * Используется для подключения интернационализации к Vue приложению
 *
 * Пример использования:
 * import i18n from '@/i18n';
 * app.use(i18n);
 */
export default i18n;
