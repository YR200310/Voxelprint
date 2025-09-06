import { UIUtil } from '../../util/ui_util';
import { BaseComponent } from './base';

export class HeaderComponent extends BaseComponent<HTMLDivElement> {
    private static _instance: HeaderComponent;
    public static get Get() {
        return this._instance || (this._instance = new this());
    }

    private constructor() {
        super();
    }

    protected override _onEnabledChanged(): void {
        return;
    }

    public override generateHTML(): string {
        return `
            <div class="col-container header-cols">
                <div class="col-container">
                    
                    <div class="col-item">
                        <div class="row-container">
                            <div class="row-item title" style="font-size: 22px;">
                                クリーパー系
                            </div>
                            <div class="row-item subtitle"></div>
                        </div>
                    </div>
                </div>
            </div>

        `;
    }

    public refresh() {
        // No dynamic header content
    }

    public override registerEvents(): void {
        // No-op
    }

    public override finalise(): void {
        // No-op
    }
}
