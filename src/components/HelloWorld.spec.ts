import { mount } from "@vue/test-utils";
import { vi } from "vitest";
import HelloWorld from "./HelloWorld.vue";
import { switchLocale } from "@/i18n";

// 1. Изолируем импорт i18n, создавая mock-функцию
vi.mock("@/i18n", () => ({
  switchLocale: vi.fn(),
}));

// Заглушаем импорты картинок, чтобы Vitest не спотыкался об ассеты
vi.mock("@/assets/hero.png", () => ({ default: "mock-hero.png" }));
vi.mock("@/assets/vite.svg", () => ({ default: "mock-vite.svg" }));
vi.mock("@/assets/vue.svg", () => ({ default: "mock-vue.svg" }));

describe("Компонент HelloWorld.vue", () => {
  // Фабрика для удобного монтирования с глобальными плагинами/свойствами
  const createWrapper = () => {
    return mount(HelloWorld, {
      global: {
        mocks: {
          // Имитируем работу функции перевода $t
          $t: (key: string) => `translated_${key}`,
        },
      },
    });
  };

  test("Корректно рендерит текст локализации", () => {
    const wrapper = createWrapper();

    // Проверяем, что $t('hello') отработал внутри h2
    expect(wrapper.find("h2").text()).toBe("translated_hello");
  });

  test('Вызывает функцию switchLocale при клике на "Switch language"', async () => {
    const wrapper = createWrapper();

    // Находим кнопку смены языка (первая кнопка .counter в верстке)
    const switchBtn = wrapper.findAll("button.counter")[0];

    await switchBtn.trigger("click");

    // Проверяем, что оригинальная функция i18n была вызвана
    expect(switchLocale).toHaveBeenCalledTimes(1);
  });

  test("Изменяет внутренний счетчик кликов count", async () => {
    const wrapper = createWrapper();

    // Находим кнопку счетчика (вторая кнопка .counter в верстке)
    const counterBtn = wrapper.findAll("button.counter")[1];

    // Проверяем изначальный текст кнопки
    expect(counterBtn.text()).toBe("Count is 0");

    // Симулируем первый клик
    await counterBtn.trigger("click");
    expect(counterBtn.text()).toBe("Count is 1");

    // Симулируем второй клик
    await counterBtn.trigger("click");
    expect(counterBtn.text()).toBe("Count is 2");
  });

  test("Содержит блок внешних ссылок и документации", () => {
    const wrapper = createWrapper();

    // Убедимся, что разделы со ссылками отрендерились
    expect(wrapper.find("#docs").exists()).toBe(true);
    expect(wrapper.find("#social").exists()).toBe(true);

    // Проверяем наличие критически важной ссылки на репозиторий
    const githubLink = wrapper.find('a[href="https://github.com/vitejs/vite"]');
    expect(githubLink.exists()).toBe(true);
  });
});
