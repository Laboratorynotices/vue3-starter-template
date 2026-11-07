import i18n from "@/i18n";
import type { AvailableLocale } from "@/i18n";

// глобальная константа из vite.config.ts
declare const __APP_BASE__: string;

// Базовый URL для всех API-запросов, включая язык и версию API
const API_BASE_URL = `${__APP_BASE__}api/v1`;

// Общий контракт: каждый ответ API содержит language
export interface ApiResponse {
  language: AvailableLocale;
}

// Ошибка API с кодом и текстом статуса
interface ApiError extends Error {
  status: number;
  statusText: string;
}

// Создаёт объект ошибки API с кодом, текстом статуса и сообщением
const createApiError = (
  status: number,
  statusText: string,
  message: string,
): ApiError => {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.statusText = statusText;
  return error;
};

// Получает полный URL для API-запроса к указанному endpoint
const getApiUrl = (endpoint: string): string => `${API_BASE_URL}/${endpoint}`;

/**
 * Выполняет API-запрос к указанному endpoint с заданными опциями.
 * @template T - тип данных, который ожидается в ответе API. Должен расширять ApiResponse.
 * @param endpoint - endpoint API (например, "seo/en.json")
 * @param options - опции запроса
 * @returns Promise<T> - промис, который разрешается в данные типа T.
 */
const apiRequest = async <T extends ApiResponse>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> => {
  let data: T;

  // try/catch только вокруг сети и парсинга,
  // чтобы ошибки валидации не превращались в "Network or parsing error"
  try {
    const response = await fetch(getApiUrl(endpoint), {
      ...options, // options раньше headers, иначе headers перетрёт нужное
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw createApiError(
        response.status,
        response.statusText,
        `API request failed: ${response.status} ${response.statusText}`,
      );
    }

    data = await response.json();
  } catch (error) {
    if (error instanceof Error && "status" in error) {
      throw error;
    }
    throw new Error(
      `Network or parsing error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  // Валидация контракта ответа
  if (!data || typeof data !== "object") {
    throw new Error("No data received from API");
  }

  const expected = i18n.global.locale.value;
  if (data.language !== expected) {
    throw new Error(
      `API language mismatch: expected ${expected}, got ${data.language}`,
    );
  }

  return data;
};

/**
 * Выполняет GET-запрос к API и возвращает данные, приведённые к типу T.
 * @template T - тип данных, который ожидается в ответе API. Должен расширять ApiResponse.
 * @param endpoint
 * @returns Promise<T> - промис, который разрешается в данные типа T.
 */
export const apiGet = <T extends ApiResponse>(endpoint: string): Promise<T> =>
  apiRequest<T>(endpoint, { method: "GET" });
