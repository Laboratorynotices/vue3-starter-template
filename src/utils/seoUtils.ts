import i18n from "@/i18n";
import { apiGet, type ApiResponse } from "./apiUtils";
import { toPlainText } from "./sanitizeUtils";

const SEO_ENDPOINT = "seo";

/** Ядро SEO-данных, полученных по API */
interface SeoItem {
  title: string;
  description: string;
  keywords: string;
}

/** SEO-данные, полученные по API */
interface SeoResponse extends ApiResponse {
  seo: SeoItem;
}

/**
 * Обновляет или создаёт meta-тег с указанным name и content.
 * Если тег с таким name уже есть, то его content перезаписывается.
 */
const updateMetaTag = (name: string, content: string): void => {
  let metaTag = document.querySelector<HTMLMetaElement>(`meta[name='${name}']`);

  if (!metaTag) {
    metaTag = document.createElement("meta");
    metaTag.name = name;
    document.head.appendChild(metaTag);
  }

  metaTag.content = content;
};

/**
 * Применяет SEO-данные к странице как есть.
 * Для данных, полученных по API.
 */
const applySeo = (seo: SeoItem): void => {
  document.title = toPlainText(seo.title, 200);
  updateMetaTag("description", toPlainText(seo.description, 500));
  updateMetaTag("keywords", toPlainText(seo.keywords, 500));
  document.documentElement.setAttribute("lang", i18n.global.locale.value);
};

/**
 * Получает SEO-данные по API.
 * @throws {Error} Если произошла ошибка сети, парсинга или валидации данных.
 * @returns {Promise<SeoResponse>} SEO-данные.
 */
export const fetchSeo = async (): Promise<SeoResponse> => {
  const data = await apiGet<SeoResponse>(
    `${SEO_ENDPOINT}/${i18n.global.locale.value}.json`,
  );

  if (!data.seo) {
    throw new Error("Invalid SEO data received from API");
  }

  return data;
};

/**
 * Обновляет SEO-данные с использованием данных, полученных по API.
 */
export const updateSEO = async (): Promise<void> => {
  try {
    const data = await fetchSeo();
    applySeo(data.seo);
  } catch (error) {
    console.error("Failed to update SEO tags:", error);
  }
};
