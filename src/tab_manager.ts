export class TabManager {
  private static _instance: TabManager;
  public static get Get() {
    return this._instance || (this._instance = new this());
  }

  private constructor() {
    this.setupTabListeners();
  }

  private setupTabListeners(): void {
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', () => {
        const tabId = button.getAttribute('data-tab');
        this.openTab(tabId!);
      });
    });
  }

  public openTab(tabId: string): void {
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.remove('active');
    });
    document.querySelectorAll('.tab-button').forEach(button => {
      button.classList.remove('active');
    });

    document.getElementById(tabId)?.classList.add('active');
    document.querySelector(`.tab-button[data-tab="${tabId}"]`)?.classList.add('active');
  }
}
