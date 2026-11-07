# apiUtils

Утилитарный модуль `src/utils/apiUtils.ts` с общим слоем HTTP-запросов к API в многоязычном приложении на Vue 3. Формирует URL с учётом базового пути приложения, выполняет запрос через `fetch`, приводит ошибки к единому виду и проверяет контракт ответа (в том числе язык).

Сейчас наружу экспортируются функция `apiGet` и интерфейс `ApiResponse`. Модуль используется в `seoUtils.ts`, а в дальнейшем на его основе можно подключать любые другие ресурсы.

## Содержание

- [Обзор](#обзор)
- [Как это работает](#как-это-работает)
- [Импорт и зависимости](#импорт-и-зависимости)
- [Контракт API](#контракт-api)
- [Константы](#константы)
- [Функции](#функции)
- [Примеры использования](#примеры-использования)
- [Обработка ошибок и отладка](#обработка-ошибок-и-отладка)
- [Ограничения и особенности](#ограничения-и-особенности)
- [Возможные улучшения](#возможные-улучшения)
- [Тестирование](#тестирование)
- [Совместимость](#совместимость)
- [Связанные файлы](#связанные-файлы)

## Обзор

Модуль решает четыре задачи:

| Задача                           | Как решается                                                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Корректные URL на любом хостинге | Базовый путь берётся из глобальной переменной `__APP_BASE__` (`/` локально, `/vue3-starter-template/` на GitHub Pages) |
| Единый формат ошибок             | Ошибки HTTP превращаются в `ApiError` со `status` и `statusText`, остальные — в `Network or parsing error`             |
| Проверка контракта ответа        | Тело должно быть объектом, а `language` должен совпадать с текущей локалью `i18n`                                      |
| Типизация ответов                | Обобщение `T extends ApiResponse` не позволяет запросить тип без поля `language`                                       |

> **Важно.** Параметр типа `T` лишь сообщает TypeScript, что ожидается в ответе. Во время выполнения проверяются только тип тела и поле `language`, остальная структура данных не валидируется. Это обязанность вызывающего кода (как `fetchSeo`, проверяющая блок `seo`).

## Как это работает

1. Вызывающий код вызывает `apiGet<T>("seo/ru.json")`.
2. `apiGet` вызывает `apiRequest` с `method: "GET"`.
3. `apiRequest` строит полный URL: `<base>api/v1/seo/ru.json` (через `getApiUrl`).
4. Выполняется `fetch` с заголовком `Content-Type: application/json` (его можно переопределить через `options.headers`).
5. Если статус не `2xx` (`!response.ok`), создаётся и бросается `ApiError`.
6. Тело ответа разбирается как JSON.
7. Ошибки сети, разбора JSON и ошибка HTTP обрабатываются единым `catch`: `ApiError` пробрасывается как есть, остальные оборачиваются в `Network or parsing error`.
8. Вне `try/catch` проверяется, что тело существует и является объектом.
9. Проверяется, что `data.language` совпадает с `i18n.global.locale.value`.
10. Данные возвращаются вызывающему коду.

`try/catch` намеренно охватывает только сеть и разбор JSON: ошибки валидации (шаги 8 и 9) не должны маскироваться под `Network or parsing error`.

## Импорт и зависимости

```typescript
import { apiGet, type ApiResponse } from "@/utils/apiUtils";
```

В `seoUtils.ts` используется относительный путь:

```typescript
import { apiGet, type ApiResponse } from "./apiUtils";
```

Модуль зависит от:

- экземпляра `i18n` — получение текущей локали (`i18n.global.locale.value`; предполагается режим Composition API, `legacy: false`);
- типа `AvailableLocale` из `@/i18n` — подключается через `import type`, поэтому в сборку не попадает;
- глобальной константы `__APP_BASE__`, которую определяет `vite.config.ts`. В самом модуле она объявлена через `declare const __APP_BASE__: string;`.

> Между `src/i18n.ts` и `src/utils/apiUtils.ts` существует циклическая зависимость через `seoUtils.ts` (`i18n.ts` → `seoUtils.ts` → `apiUtils.ts` → `i18n.ts`). Она безопасна, пока `i18n` используется только внутри тел функций (так и сделано: обращение к `i18n.global.locale.value` происходит во время запроса, а не при загрузке модуля).

## Контракт API

### Общий контракт `ApiResponse`

```typescript
export interface ApiResponse {
  language: AvailableLocale;
}
```

Каждый ответ API должен содержать поле `language` с кодом языка (`ru`, `en`, `de`). Типы конкретных ответов расширяют этот интерфейс:

```typescript
interface SeoResponse extends ApiResponse {
  seo: SeoItem;
}
```

Требования к серверу (и к mock-файлам в `public/api/v1/`):

- ответ является JSON-объектом (не массивом, не `null` и не строкой);
- `language` присутствует и совпадает с языком, для которого запрашивался ресурс;
- при ошибке сервер возвращает HTTP-статус не `2xx`.

### ApiError

```typescript
interface ApiError extends Error {
  status: number;
  statusText: string;
}
```

Ошибка HTTP-запроса. Это внутренний интерфейс, а не класс: он не экспортируется, и `instanceof ApiError` использовать нельзя. Такая ошибка отличается наличием поля `status`:

```typescript
if (error instanceof Error && "status" in error) {
  console.error("HTTP-статус:", error.status);
}
```

### Формирование URL

```
<__APP_BASE__>api/v1/<endpoint>
```

| Режим                       | `__APP_BASE__`            | Результат для `seo/ru.json`                 |
| --------------------------- | ------------------------- | ------------------------------------------- |
| `development`, `production` | `/`                       | `/api/v1/seo/ru.json`                       |
| `ghpages`                   | `/vue3-starter-template/` | `/vue3-starter-template/api/v1/seo/ru.json` |

`endpoint` задаётся без начального слэша (`seo/ru.json`), иначе в URL появится двойной слэш (`api/v1//seo/ru.json`). Строка запроса может передаваться в составе `endpoint`.

## Константы

### `__APP_BASE__`

```typescript
declare const __APP_BASE__: string;
```

Глобальная константа, определённая в `vite.config.ts` через опцию `define`. Содержит базовый путь приложения и **всегда заканчивается слэшем**: на это опирается формирование `API_BASE_URL`. Директива `declare` лишь сообщает TypeScript о существовании константы.

> Значение подставляется сборщиком. Если модуль выполняется вне Vite без такого определения (например, в тестах без `define`), обращение к `__APP_BASE__` приведёт к `ReferenceError` при загрузке модуля. См. раздел [Тестирование](#тестирование).

### API_BASE_URL

```typescript
const API_BASE_URL = `${__APP_BASE__}api/v1`;
```

Базовый URL для всех запросов: включает базовый путь приложения и версию API. Вычисляется один раз при загрузке модуля. Константа не экспортируется.

## Функции

### createApiError (внутренняя)

```typescript
createApiError(status: number, statusText: string, message: string): ApiError
```

Создаёт объект `Error` с сообщением `message` и дописывает ему поля `status` и `statusText`. Не экспортируется.

### getApiUrl (внутренняя)

```typescript
getApiUrl(endpoint: string): string
```

Возвращает полный URL: `${API_BASE_URL}/${endpoint}`. Не экспортируется.

### apiRequest (внутренняя)

```typescript
apiRequest<T extends ApiResponse>(endpoint: string, options?: RequestInit): Promise<T>
```

Выполняет запрос и проверяет контракт ответа. Не экспортируется (точка входа — `apiGet`).

**Параметры:**

- `endpoint` (string) — endpoint API, например `"seo/en.json"`;
- `options` (`RequestInit`, по умолчанию `{}`) — опции `fetch`.

**Заголовки.** Итоговый объект собирается как `{ "Content-Type": "application/json", ...options.headers }`: заголовки по умолчанию объединяются с переданными, а переданные побеждают при совпадении имён. Порядок в `fetch({ ...options, headers })` важен: `options` стоит раньше `headers`, иначе `options.headers` целиком заменил бы объединённый объект.

**Возвращает:** `Promise<T>` с данными, прошедшими проверку.

**Ошибки:**

- `ApiError` — HTTP-статус не `2xx`. Сообщение: `API request failed: <status> <statusText>`;
- `Error("Network or parsing error: …")` — сетевой сбой, прерванный запрос или некорректный JSON;
- `Error("No data received from API")` — тело ответа пустое (`null`) или не является объектом;
- `Error("API language mismatch: expected …, got …")` — язык ответа не совпадает с текущей локалью.

### apiGet

```typescript
apiGet<T extends ApiResponse>(endpoint: string): Promise<T>
```

Публичная точка входа. Выполняет GET-запрос и возвращает данные, приведённые к типу `T`. Тонкая обёртка над `apiRequest` с `method: "GET"`.

**Параметры:**

- `endpoint` (string) — endpoint API без начального слэша.

**Возвращает:** `Promise<T>`.

**Ошибки:** см. `apiRequest`. Функция сама ошибки не перехватывает, обработка остаётся за вызывающим кодом.

**Пример:**

```typescript
const data = await apiGet<SeoResponse>("seo/ru.json");
```

## Примеры использования

### Подключение нового ресурса

Допустим, нужен ресурс с содержимым страницы. Достаточно описать тип ответа (расширяющий `ApiResponse`) и вызвать `apiGet`. Ядро менять не нужно:

```typescript
import i18n from "@/i18n";
import { apiGet, type ApiResponse } from "@/utils/apiUtils";

interface HomePageResponse extends ApiResponse {
  page: {
    heading: string;
    text: string;
  };
}

export const fetchHomePage = async (): Promise<HomePageResponse> => {
  const data = await apiGet<HomePageResponse>(
    `pages/home/${i18n.global.locale.value}.json`,
  );

  // Проверка структуры ресурса остаётся за вызывающим кодом
  if (!data.page) {
    throw new Error("Invalid home page data received from API");
  }

  return data;
};
```

Файл `public/api/v1/pages/home/ru.json` должен содержать `"language": "ru"` и блок `page`.

### Разбор ошибок по статусу

```typescript
try {
  await fetchHomePage();
} catch (error) {
  if (error instanceof Error && "status" in error) {
    const status = (error as Error & { status: number }).status;

    if (status === 404) {
      console.warn("Ресурс не найден");
    } else if (status >= 500) {
      console.error("Ошибка сервера");
    }
  } else {
    console.error("Сеть, JSON или валидация:", error);
  }
}
```

### Использование в seoUtils

```typescript
export const fetchSeo = async (): Promise<SeoResponse> => {
  const data = await apiGet<SeoResponse>(
    `${SEO_ENDPOINT}/${i18n.global.locale.value}.json`,
  );

  if (!data.seo) {
    throw new Error("Invalid SEO data received from API");
  }

  return data;
};
```

## Обработка ошибок и отладка

### Типы ошибок

| Ситуация                              | Что происходит                                                  | Тип ошибки                              |
| ------------------------------------- | --------------------------------------------------------------- | --------------------------------------- |
| Нет соединения, сбой DNS, CORS        | `fetch` отклоняется, ошибка оборачивается                       | `Error` («Network or parsing error: …») |
| Статус 4xx или 5xx                    | Бросается `ApiError`, `catch` пробрасывает его без обёртки      | `ApiError` со `status`                  |
| Тело не является корректным JSON      | `response.json()` отклоняется, ошибка оборачивается             | `Error` («Network or parsing error: …») |
| Прерванный запрос (`AbortController`) | Сейчас принимается за сетевую ошибку: имя `AbortError` теряется | `Error` («Network or parsing error: …») |
| Тело `null` или не объект             | Бросается после `try/catch`                                     | `Error` («No data received from API»)   |
| Язык не совпал с текущей локалью      | Бросается после `try/catch`                                     | `Error` («API language mismatch: …»)    |

### Типичные неожиданности

| Симптом                                                | Вероятная причина                                                                                     |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `Network or parsing error: Unexpected token '<' …`     | Вместо JSON пришёл HTML (например, `index.html` от SPA-fallback сервера или страница ошибки хостинга) |
| 404 на GitHub Pages при нормальной работе локально     | Собрано не в режиме `ghpages`, и `__APP_BASE__` равен `/`: запрос ушёл в корень домена                |
| `API language mismatch: expected ru, got undefined`    | В ответе нет поля `language`                                                                          |
| `API language mismatch` при быстром переключении языка | Ответ на прежний язык пришёл после смены локали (ожидаемая локаль читается после ответа)              |
| Сообщение `API request failed: 404 ` с пустым хвостом  | При HTTP/2 текст статуса (`statusText`) пустой                                                        |
| `ReferenceError: __APP_BASE__ is not defined`          | Модуль выполняется без определения константы (тесты, скрипты вне Vite)                                |
| Не применяются пользовательские заголовки              | Переданы не обычным объектом, а `Headers` или массивом пар (спред даёт неверный результат)            |

### Отладка

Для отладки можно временно проверять итоговый URL и ответ:

```typescript
console.log(
  "URL запроса:",
  `${__APP_BASE__}api/v1/seo/${i18n.global.locale.value}.json`,
);
```

Остальное удобно смотреть во вкладке Network в DevTools: URL, статус, `Content-Type` ответа и само тело.

## Ограничения и особенности

1. **Только GET.** Публичный интерфейс содержит одну функцию. `apiGet` не принимает `options`, поэтому передать заголовки, `signal` для отмены или другие параметры `fetch` через неё нельзя. `apiRequest` это умеет, но не экспортируется.
2. **Язык проверяется для всех ответов.** Любой ресурс, проходящий через слой, обязан содержать `language`. Для ресурсов, не зависящих от языка, такой контракт не подходит.
3. **Локаль читается после ответа.** Ожидаемый язык берётся из `i18n` в момент проверки, а не в момент отправки запроса. Благодаря этому устаревший ответ при быстрой смене языка отвергается, но ценой ложной на вид ошибки.
4. **`Content-Type` у GET.** Заголовок `Content-Type: application/json` выставляется всегда, хотя у GET нет тела. При запросах на другой домен он делает запрос «непростым» и вызывает preflight.
5. **Слияние заголовков через спред.** Корректно работает, только если `options.headers` — обычный объект.
6. **Отмена запроса не различается.** `AbortError` оборачивается в `Network or parsing error`, и по имени ошибки отличить отмену нельзя.
7. **Нет таймаута, повторов и кеша.** Поведение целиком зависит от браузера и серверных заголовков кеширования.
8. **`ApiError` не экспортируется.** Тип недоступен снаружи, а проверка выполняется по наличию поля `status`. Любая другая ошибка со свойством `status` будет принята за ошибку API.
9. **Тело ошибки игнорируется.** При статусе 4xx и 5xx сообщение сервера из тела ответа не читается.
10. **Массив проходит проверку тела.** `typeof [] === "object"`, поэтому массив не попадёт под `No data received from API`, а упадёт чуть позже на проверке языка.
11. **Тип не проверяется во время выполнения.** `response.json()` возвращает `any`, а `T` — лишь утверждение для TypeScript.
12. **Базовый путь вычисляется один раз** при загрузке модуля и в течение работы приложения не меняется.

## Возможные улучшения

Пока это предложения, в модуле они не реализованы.

**Запоминать локаль до запроса** (или принимать её параметром), чтобы проверка относилась к тому языку, для которого запрос был отправлен:

```typescript
const expected = i18n.global.locale.value; // до await fetch(...)
```

В связке с `AbortController` (передача `signal` через `options`) это уберёт ложные ошибки `API language mismatch` при быстрой смене языка. Тогда `apiGet` стоит расширить вторым параметром `options`, а в `catch` пробрасывать отмену без обёртки:

```typescript
if (error instanceof DOMException && error.name === "AbortError") {
  throw error;
}
```

**Корректная работа с заголовками** и `Content-Type` только для запросов с телом:

```typescript
const headers = new Headers(options.headers);

if (options.body !== undefined && !headers.has("Content-Type")) {
  headers.set("Content-Type", "application/json");
}

const response = await fetch(getApiUrl(endpoint), { ...options, headers });
```

**Экспортируемый класс ошибки и проверка типа**, вместо поиска поля `status`:

```typescript
export class ApiError extends Error {
  status: number;
  statusText: string;

  constructor(status: number, statusText: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
  }
}

// в вызывающем коде
if (error instanceof ApiError && error.status === 404) {
  // ...
}
```

**Усиление проверки тела:** `Array.isArray(data)` в условии `No data received from API`.

**Чтение сообщения сервера** при `!response.ok` (если API возвращает JSON с текстом ошибки) и добавление его в `ApiError`.

**Опция для ресурсов без языка**, например флаг `skipLanguageCheck`, если появятся данные, не зависящие от локали.

**Другие методы:** `apiPost`, `apiPut`, `apiDelete` рядом с `apiGet`. Ядро `apiRequest` менять не потребуется.

**Таймаут:** `AbortSignal.timeout(ms)` или собственный `AbortController`.

**Вынести `declare const __APP_BASE__: string;`** в общий `env.d.ts` (или `global.d.ts`), чтобы не повторять объявление в каждом файле, и чтобы не конфликтовать с правилом ESLint `no-undef`.

**Альтернатива собственной переменной:** в Vite уже есть `import.meta.env.BASE_URL`, равный опции `base`. Если оставлять `__APP_BASE__`, то значение `base` и `__APP_BASE__` должны вычисляться из одной переменной (как сейчас в `vite.config.ts`).

## Тестирование

Модуль удобно тестировать с помощью Vitest, подменяя `fetch` и `i18n`. Константа `__APP_BASE__` читается при загрузке модуля, поэтому её нужно определить до импорта: либо через `define` в конфиге Vitest, либо подменой глобальной переменной и динамическим импортом, как ниже.

```typescript
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("@/i18n", () => ({
  default: { global: { locale: { value: "ru" } } },
}));

let apiGet: typeof import("@/utils/apiUtils").apiGet;
const fetchMock = vi.fn();

beforeAll(async () => {
  vi.stubGlobal("__APP_BASE__", "/");
  ({ apiGet } = await import("@/utils/apiUtils"));
});

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
});

const okResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  statusText: "OK",
  json: async () => body,
});

describe("apiGet", () => {
  it("запрашивает правильный URL и возвращает данные", async () => {
    fetchMock.mockResolvedValue(okResponse({ language: "ru" }));

    await expect(apiGet("seo/ru.json")).resolves.toEqual({ language: "ru" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/seo/ru.json",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("бросает ApiError со статусом при ответе не 2xx", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    await expect(apiGet("seo/ru.json")).rejects.toMatchObject({
      status: 404,
      statusText: "Not Found",
    });
  });

  it("оборачивает сетевые ошибки", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(apiGet("seo/ru.json")).rejects.toThrow(
      "Network or parsing error: Failed to fetch",
    );
  });

  it("бросает ошибку при пустом теле", async () => {
    fetchMock.mockResolvedValue(okResponse(null));

    await expect(apiGet("seo/ru.json")).rejects.toThrow(
      "No data received from API",
    );
  });

  it("бросает ошибку при несовпадении языка", async () => {
    fetchMock.mockResolvedValue(okResponse({ language: "en" }));

    await expect(apiGet("seo/ru.json")).rejects.toThrow(
      "API language mismatch",
    );
  });
});
```

Такие тесты не обращаются к сети и не зависят от DOM.

## Совместимость

- **Vue I18n**: 9.0+ в режиме Composition API (`legacy: false`): используется `i18n.global.locale.value`.
- **TypeScript**: 4.0+ (используются `import type`, обобщения с ограничением и `declare const`).
- **Браузеры**: все современные браузеры с поддержкой Fetch API и ES6+.
- **Сборщик**: Vite с опцией `define`, в которой задан `__APP_BASE__`.

## Связанные файлы

- `src/utils/seoUtils.ts` — основной потребитель: `fetchSeo` вызывает `apiGet`.
- `src/utils/sanitizeUtils.ts` — санитайзинг строк, полученных через этот слой.
- `src/i18n.ts` — источник текущей локали и типа `AvailableLocale`.
- `vite.config.ts` — определение глобальной переменной `__APP_BASE__`.
- `public/api/v1/**` — mock-файлы ответов API для разработки.
- `src/utils/seoUtils.md`, `src/utils/sanitizeUtils.md` — документация связанных модулей.
