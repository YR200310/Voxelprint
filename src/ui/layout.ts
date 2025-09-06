import { AppContext } from '../app_context';
import { ArcballCamera } from '../camera';
import { EAppEvent, EventManager } from '../event';
import { TExporters } from '../exporters/exporters';
import { LOC, Localiser, TLocalisedString } from '../localiser';
import { MeshType, Renderer } from '../renderer';
import { EAction } from '../util';
import { ASSERT } from '../util/error_util';
import { TAxis } from '../util/type_util';
import { UIUtil } from '../util/ui_util';
import { TVoxelOverlapRule } from '../voxel_mesh';
import { TVoxelisers } from '../voxelisers/voxelisers';
import { ButtonComponent } from './components/button';
import { CheckboxComponent } from './components/checkbox';
import { ComboboxComponent } from './components/combobox';
import { ConfigComponent } from './components/config';
import { FileComponent } from './components/file_input';
import { HeaderComponent } from './components/header';
import { PlaceholderComponent } from './components/placeholder';
import { SliderComponent } from './components/slider';
import { ToolbarItemComponent } from './components/toolbar_item';
import { AppIcons } from './icons';
import { HTMLBuilder, MiscComponents } from './misc';
import { AppConfig } from '../config';

export type Group = {
    id: string,
    label: TLocalisedString;
    components: { [key: string]: ConfigComponent<any, any> };
    componentOrder: string[];
    execButton?: ButtonComponent;
}

export interface ToolbarGroup {
    components: { [key: string]: ToolbarItemComponent };
    componentOrder: string[];
}

export class UI {
    /* Singleton */
    private static _instance: UI;
    public static get Get() {
        return this._instance || (this._instance = new this());
    }

    public constructor() {

        EventManager.Get.add(EAppEvent.onLanguageChanged, () => {
            this._handleLanguageChange();
        });

        EventManager.Get.add(EAppEvent.onTaskProgress, (e: any) => {
            const lastAction = this._appContext?.getLastAction();
            if (lastAction !== undefined) {
                this.getActionButton(lastAction)?.setProgress(e[1]);
            }
        });

        // Wire the Import voxelSize slider to the Voxelise size and re-run voxelisation on change
        const voxelSizeSlider = this._ui.import.components['voxelSize'] as SliderComponent;
        voxelSizeSlider.addValueChangedListener(async (newValue: number) => {
            this._ui.voxelise.components.size.setValue(newValue);
            if (this._appContext && (this._appContext.getLastAction?.() ?? 0) >= EAction.Import) {
                await this._appContext.do(EAction.Voxelise);
            }
        });
    }

    public uiOrder = ['settings', 'import', 'materials', 'voxelise', 'assign', 'export'];
    public _ui = {
        'settings': {
            id: 'settings',
            label: LOC('settings.heading'),
            components: {
                'language': new ComboboxComponent<string>(), // Handled in constructor
                'overrideHeight': new SliderComponent()
                    .setMin(16)
                    .setMax(10000)
                    .setDefaultValue(380)
                    .setDecimals(0)
                    .setStep(1)
                    .setLabel('settings.components.overrideHeight')
                    .addValueChangedListener((newValue) => {
                        AppConfig.Get.CONSTRAINT_MAXIMUM_HEIGHT = newValue;
                    })
            },
            componentOrder: ['language', 'overrideHeight'],
        },
        'import': {
            id: 'import',
            label: 'インポート&レイヤー作成',
            components: {
                'input': new FileComponent()
                    .setUnlocalisedLabel('3D file選択 (.glb)'),
                'voxelSize': new SliderComponent()
                    .setMin(3)
                    .setMax(380)
                    .setDefaultValue(80)
                    .setDecimals(0)
                    .setStep(1)
                    .setUnlocalisedLabel('Voxel Resolution'),
            },
            componentOrder: ['input', 'voxelSize'],
            // No exec button for Import in simplified UI
        },
        'materials': {
            id: 'materials',
            label: LOC('materials.heading'),
            components: {},
            componentOrder: [],
        },
        'voxelise': {
            id: 'voxelise',
            label: 'Voxelise',
            components: {
                'constraintAxis': new ComboboxComponent<TAxis>()
                    .addItem({ payload: 'y', displayLocKey: 'voxelise.components.y_axis' })
                    .addItem({ payload: 'x', displayLocKey: 'voxelise.components.x_axis' })
                    .addItem({ payload: 'z', displayLocKey: 'voxelise.components.z_axis' })
                    .setLabel('voxelise.components.constraint_axis')
                    .addValueChangedListener((value: TAxis) => {
                        switch (value) {
                            case 'x': {
                                ASSERT(this._appContext !== undefined && this._appContext.minConstraint !== undefined && this._appContext.maxConstraint !== undefined);
                                
                                this._ui.voxelise.components.size.setMin(this._appContext.minConstraint.x);
                                this._ui.voxelise.components.size.setMax(this._appContext.maxConstraint.x);
                                break;
                            }
                            case 'y': {
                                this._ui.voxelise.components.size.setMin(AppConfig.Get.CONSTRAINT_MINIMUM_HEIGHT);
                                this._ui.voxelise.components.size.setMax(AppConfig.Get.CONSTRAINT_MAXIMUM_HEIGHT);
                                break;
                            }
                            case 'z': {
                                ASSERT(this._appContext !== undefined && this._appContext.minConstraint !== undefined && this._appContext.maxConstraint !== undefined);
                                
                                this._ui.voxelise.components.size.setMin(this._appContext.minConstraint.z);
                                this._ui.voxelise.components.size.setMax(this._appContext.maxConstraint.z);
                                break;
                            }
                        }
                    }),
                'size': new SliderComponent()
                    .setMin(3)
                    .setMax(380)
                    .setDefaultValue(80)
                    .setDecimals(0)
                    .setStep(1)
                    .setLabel('voxelise.components.size'),
                'voxeliser': new ComboboxComponent<TVoxelisers>()
                    .addItem({ payload: 'ray-based', displayLocKey: 'voxelise.components.ray_based' })
                    .addItem({ payload: 'bvh-ray', displayLocKey: 'voxelise.components.bvh_ray' })
                    .addItem({ payload: 'ncrb', displayLocKey: 'voxelise.components.ncrb' })
                    .setLabel('voxelise.components.algorithm'),
                'ambientOcclusion': new CheckboxComponent()
                    .setCheckedText('voxelise.components.on_recommended')
                    .setUncheckedText('voxelise.components.off_faster')
                    .setDefaultValue(true)
                    .setLabel('voxelise.components.ambient_occlusion'),
                'multisampleColouring': new CheckboxComponent()
                    .setCheckedText('voxelise.components.on_recommended')
                    .setUncheckedText('voxelise.components.off_faster')
                    .setDefaultValue(true)
                    .setLabel('voxelise.components.multisampling'),
                'voxelOverlapRule': new ComboboxComponent<TVoxelOverlapRule>()
                    .addItem({
                        displayLocKey: 'voxelise.components.average_recommended',
                        payload: 'average',
                    })
                    .addItem({
                        displayLocKey: 'voxelise.components.first',
                        payload: 'first',
                    })
                    .setLabel('voxelise.components.voxel_overlap'),
                'placeholder': new PlaceholderComponent()
                    .setPlaceholderText('misc.advanced_settings'),
            },
            componentOrder: [
                'constraintAxis',
                'size',
                'placeholder',
                'voxeliser',
                'ambientOcclusion',
                'multisampleColouring',
                'voxelOverlapRule',
            ],
            execButton: new ButtonComponent()
                .setOnClick(() => {
                    this._appContext?.do(EAction.Voxelise);
                })
                .setLabel(LOC('voxelise.button')),
        },
        'assign': {
            id: 'assign',
            label: 'マイクラブロック化',
            components: {
                'colourAccuracy': new SliderComponent()
                    .setMin(1)
                    .setMax(8)
                    .setDefaultValue(5)
                    .setDecimals(1)
                    .setStep(0.1)
                    .setUnlocalisedLabel('Color Accuracy'),
            },
            componentOrder: [
                'colourAccuracy',
            ],
            execButton: new ButtonComponent()
                .setOnClick(() => {
                    this._appContext?.do(EAction.Assign);
                })
                .setLabel('ブロック化実行' as any),
        },
        'export': {
            id: 'export',
            label: 'エクスポート',
            components: {
                'export': new ComboboxComponent<TExporters>()
                    .addItems([

                        {
                            displayLocKey: 'json',
                            payload: 'indexed_json',
                        },
                        {
                            displayLocKey: 'test',
                            payload: 'uncompressed_json',
                        },
                    ])
                    .setLabel('export setting'),
            },
            componentOrder: ['export'],
            execButton: new ButtonComponent()
                .setLabel('Export JSON' as any)
                .setOnClick(() => {
                    this._appContext?.do(EAction.Export);
                }),
        },
    };

    private _toolbarLeft = {
        groups: {
            'viewmode': {
                components: {
                    'mesh': new ToolbarItemComponent({ id: 'mesh', iconSVG: AppIcons.MESH })
                        .onClick(() => {
                            Renderer.Get.setModelToUse(MeshType.TriangleMesh);
                        })
                        .isActive(() => {
                            return Renderer.Get.getActiveMeshType() === MeshType.TriangleMesh;
                        })
                        .isEnabled(() => {
                            return Renderer.Get.getModelsAvailable() >= MeshType.TriangleMesh;
                        })
                        .setTooltip('toolbar.view_mesh'),
                    'voxelMesh': new ToolbarItemComponent({ id: 'voxelMesh', iconSVG: AppIcons.VOXEL })
                        .onClick(() => {
                            Renderer.Get.setModelToUse(MeshType.VoxelMesh);
                        })
                        .isActive(() => {
                            return Renderer.Get.getActiveMeshType() === MeshType.VoxelMesh;
                        })
                        .isEnabled(() => {
                            return Renderer.Get.getModelsAvailable() >= MeshType.VoxelMesh;
                        })
                        .setTooltip('toolbar.view_voxel_mesh'),
                    'blockMesh': new ToolbarItemComponent({ id: 'blockMesh', iconSVG: AppIcons.BLOCK })
                        .onClick(() => {
                            Renderer.Get.setModelToUse(MeshType.BlockMesh);
                        })
                        .isActive(() => {
                            return Renderer.Get.getActiveMeshType() === MeshType.BlockMesh;
                        })
                        .isEnabled(() => {
                            return Renderer.Get.getModelsAvailable() >= MeshType.BlockMesh;
                        })
                        .setTooltip('toolbar.view_block_mesh'),
                },
                componentOrder: ['mesh', 'voxelMesh', 'blockMesh'],
            },
            'debug': {
                components: {
                    'grid': new ToolbarItemComponent({ id: 'grid', iconSVG: AppIcons.GRID })
                        .onClick(() => {
                            Renderer.Get.toggleIsGridEnabled();
                        })
                        .isActive(() => {
                            return Renderer.Get.isGridEnabled();
                        })
                        .isEnabled(() => {
                            return Renderer.Get.getActiveMeshType() !== MeshType.None;
                        })
                        .setTooltip('toolbar.toggle_grid'),
                    'axes': new ToolbarItemComponent({ id: 'axes', iconSVG: AppIcons.AXES })
                        .onClick(() => {
                            Renderer.Get.toggleIsAxesEnabled();
                        })
                        .isActive(() => {
                            return Renderer.Get.isAxesEnabled();
                        })
                        .setTooltip('toolbar.toggle_axes'),
                    'night-vision': new ToolbarItemComponent({ id: 'night', iconSVG: AppIcons.BULB })
                        .onClick(() => {
                            Renderer.Get.toggleIsNightVisionEnabled();
                        })
                        .isActive(() => {
                            return Renderer.Get.isNightVisionEnabled();
                        })
                        .isEnabled(() => {
                            return Renderer.Get.canToggleNightVision();
                        })
                        .setTooltip('toolbar.toggle_night_vision'),
                },
                componentOrder: ['grid', 'axes', 'night-vision'],
            },
            // sliceHeight moved to right toolbar with slider and input
        },
        groupsOrder: [],
    };

    private _toolbarRight = {
        groups: {
            'camera': {
                components: {
                    'zoom-out': new ToolbarItemComponent({ id: 'zoom-out', iconSVG: AppIcons.MINUS })
                        .onClick(() => { ArcballCamera.Get.onZoomOut(); })
                        .setTooltip('toolbar.zoom_out' as any),
                    'zoom-reset': new ToolbarItemComponent({ id: 'zoom-reset', iconSVG: AppIcons.CENTRE })
                        .noIcon()
                        .setLabel('zoom')
                        .onClick(() => { ArcballCamera.Get.reset(); })
                        .setTooltip('toolbar.reset_camera' as any),
                    'zoom-in': new ToolbarItemComponent({ id: 'zoom-in', iconSVG: AppIcons.PLUS })
                        .onClick(() => { ArcballCamera.Get.onZoomIn(); })
                        .setTooltip('toolbar.zoom_in' as any),
                },
                componentOrder: ['zoom-out', 'zoom-reset', 'zoom-in'],
            },
            // camera and zoom controls removed for a simpler UI
            'layers': {
                components: {
                    'up': new ToolbarItemComponent({ id: 'layer-up', iconSVG: AppIcons.PLUS })
                        .noIcon()
                        .setLabel('+')
                        .onClick(() => { Renderer.Get.incrementSliceHeight(); })
                        .isEnabled(() => Renderer.Get.canIncrementSliceHeight()),
                    'value': new ToolbarItemComponent({ id: 'layer-value', iconSVG: AppIcons.GRID })
                        .noIcon()
                        .setLabel('<input type="number" id="layer-input" class="struct-prop" style="width: 40px; text-align: center;" />'),
                    'down': new ToolbarItemComponent({ id: 'layer-down', iconSVG: AppIcons.MINUS })
                        .noIcon()
                        .setLabel('-')
                        .onClick(() => { Renderer.Get.decrementSliceHeight(); })
                        .isEnabled(() => Renderer.Get.canDecrementSliceHeight()),
                    'slider': new ToolbarItemComponent({ id: 'layer-slider-item', iconSVG: AppIcons.SLICE })
                        .noIcon()
                        .setLabel('<div style="width: 40px; height: 260px; display:flex; align-items:center; justify-content:center; overflow: visible;"><input type="range" id="layer-slider" min="0" max="0" step="1" style="transform: rotate(-90deg); width: 220px;" /></div>'),
                },
                componentOrder: ['up', 'value', 'down', 'slider'],
            },
        },
        groupsOrder: ['camera', 'layers'],
    };

    private _uiDull: { [key: string]: Group } = this._ui;
    private _toolbarLeftDull: { [key: string]: ToolbarGroup } = this._toolbarLeft.groups;
    private _toolbarRightDull: { [key: string]: ToolbarGroup } = this._toolbarRight.groups;

    private _appContext?: AppContext;

    public bindToContext(context: AppContext) {
        this._appContext = context;
    }

    public tick(isBusy: boolean) {
        if (isBusy) {
            document.body.style.cursor = 'progress';
        } else {
            document.body.style.cursor = 'default';
        }

        const canvasColumn = UIUtil.getElementById('col-canvas');
        if (ArcballCamera.Get.isUserRotating || ArcballCamera.Get.isUserTranslating) {
            canvasColumn.style.cursor = 'grabbing';
        } else {
            canvasColumn.style.cursor = 'grab';
        }

        for (const toolbarGroupName of this._toolbarLeft.groupsOrder) {
            const toolbarGroup = this._toolbarLeftDull[toolbarGroupName];
            for (const toolbarItem of toolbarGroup.componentOrder) {
                toolbarGroup.components[toolbarItem].tick();
            }
        }

        for (const toolbarGroupName of this._toolbarRight.groupsOrder) {
            const toolbarGroup = this._toolbarRightDull[toolbarGroupName];
            for (const toolbarItem of toolbarGroup.componentOrder) {
                toolbarGroup.components[toolbarItem].tick();
            }
        }

        // Keep layer input/slider in sync (zero-based indexing)
        const layerInput = document.getElementById('layer-input') as HTMLInputElement | null;
        const layerSlider = document.getElementById('layer-slider') as HTMLInputElement | null;
        if (layerInput && layerSlider) {
            const hasModel = Renderer.Get.getActiveMeshType() !== MeshType.None;
            if (hasModel) {
                const minAbs = Renderer.Get.getSliceMin();
                const maxAbs = Renderer.Get.getSliceMax();
                const valAbs = Renderer.Get.getSliceHeight();
                const range = maxAbs - minAbs;
                const valZero = valAbs - minAbs;
                layerSlider.min = '0';
                layerSlider.max = String(range);
                if (document.activeElement !== layerSlider) layerSlider.value = String(valZero);
                if (document.activeElement !== layerInput) layerInput.value = String(valZero);
                layerInput.disabled = false;
                layerSlider.disabled = false;
            } else {
                layerInput.disabled = true;
                layerSlider.disabled = true;
            }
        }
    }

    public build() {
        // Build header and properties
        {
            // Header at top-left
            const headerHTML = new HTMLBuilder();
            headerHTML.add(HeaderComponent.Get.generateHTML());
            headerHTML.placeInto('header');

            // Properties in bottom bar: render all groups, hide advanced later
            const propsHTML = new HTMLBuilder();
            propsHTML.add(`<div class="container-properties">`);
            for (const groupName of this.uiOrder) {
                const group = this._uiDull[groupName];
                propsHTML.add(this._getGroupHTML(group));
            }
            propsHTML.add(`</div>`);
            propsHTML.placeInto('properties');

            // Hide advanced groups but keep DOM for internal logic
            const hideFully = ['settings', 'materials', 'voxelise'];
            hideFully.forEach((gid) => {
                const header = document.getElementById(`component_header_${gid}`);
                const body = document.getElementById(`subcomponents_${gid}`);
                if (header) header.style.display = 'none';
                if (body) body.style.display = 'none';
            });
        }

        // Build toolbar
        {
            const toolbarHTML = new HTMLBuilder();

            // Left
            toolbarHTML.add('<div class="toolbar-column">');
            for (const toolbarGroupName of this._toolbarLeft.groupsOrder) {
                toolbarHTML.add(`<div class="toolbar-group" id="toolbar-left-${toolbarGroupName}">`);
                const toolbarGroup = this._toolbarLeftDull[toolbarGroupName];
                for (const groupElementName of toolbarGroup.componentOrder) {
                    const groupElement = toolbarGroup.components[groupElementName];
                    toolbarHTML.add(groupElement.generateHTML());
                }
                toolbarHTML.add('</div>');
            }
            toolbarHTML.add('</div>');

            // Right
            toolbarHTML.add('<div class="toolbar-column">');
            for (const toolbarGroupName of this._toolbarRight.groupsOrder) {
                toolbarHTML.add(`<div class="toolbar-group" id="toolbar-right-${toolbarGroupName}">`);
                const toolbarGroup = this._toolbarRightDull[toolbarGroupName];
                for (const groupElementName of toolbarGroup.componentOrder) {
                    const groupElement = toolbarGroup.components[groupElementName];
                    toolbarHTML.add(groupElement.generateHTML());
                }
                toolbarHTML.add('</div>');
            }
            toolbarHTML.add('</div>');

            toolbarHTML.placeInto('toolbar');
        }

        // Using vertical stacking layout; no Split.js sidebar

        // Reflow layers group vertically within toolbar (avoid overlap)
        const down = document.getElementById('layer-down');
        const value = document.getElementById('layer-value');
        const up = document.getElementById('layer-up');
        const sliderItem = document.getElementById('layer-slider-item');
        const layersGroup = document.getElementById('toolbar-right-layers');

        if (layersGroup && down && value && up && sliderItem) {
            // Make the layers group a vertical stack
            (layersGroup as HTMLElement).style.display = 'flex';
            (layersGroup as HTMLElement).style.flexDirection = 'column';
            (layersGroup as HTMLElement).style.alignItems = 'center';
            (layersGroup as HTMLElement).style.gap = '6px';

            // Reorder: up, value, down, slider
            layersGroup.appendChild(up);
            layersGroup.appendChild(value);
            layersGroup.appendChild(down);
            layersGroup.appendChild(sliderItem);

            // Ensure compact sizing for buttons and input
            (up as HTMLElement).style.width = '40px';
            (down as HTMLElement).style.width = '40px';
            const inputEl = (value as HTMLElement).querySelector('input') as HTMLInputElement | null;
            if (inputEl) {
                inputEl.style.width = '40px';
            }
            (sliderItem as HTMLElement).style.height = '260px';
            (sliderItem as HTMLElement).style.display = 'flex';
            (sliderItem as HTMLElement).style.alignItems = 'center';
        }
    }

    private _forEachComponent(action: EAction, functor: (component: ConfigComponent<unknown, unknown>) => void) {
        const group = this._getGroup(action);

        for (const elementName of group.componentOrder) {
            const element = group.components[elementName];
            functor(element);
        }
    }

    private _getGroupHeadingLabel(action: EAction): TLocalisedString {
        switch (action) {
            case EAction.Settings:
                return 'Settings' as any;
            case EAction.Import:
                return 'Import' as any;
            case EAction.Materials:
                return 'Materials' as any;
            case EAction.Voxelise:
                return 'Voxelise' as any;
            case EAction.Assign:
                return 'Assign' as any;
            case EAction.Export:
                return 'Export' as any;
        }
        ASSERT(false);
    }

    private _getGroupButtonLabel(action: EAction): TLocalisedString {
        switch (action) {
            case EAction.Import:
                return 'Import Mesh' as any;
            case EAction.Materials:
                return 'Update Materials' as any;
            case EAction.Voxelise:
                return 'Voxelise Mesh' as any;
            case EAction.Assign:
                return 'ブロック化' as any;
            case EAction.Export:
                return 'JSONで出力' as any;
        }
        ASSERT(false, `Cannot get label of '${action}'`);
    }

    private _handleLanguageChange() {
        HeaderComponent.Get.refresh();


        Object.values(this._toolbarLeft.groups).forEach((group) => {
            Object.values(group.components).forEach((comp) => {
                comp.updateTranslation();
            });
        });

        Object.values(this._toolbarRight.groups).forEach((group) => {
            Object.values(group.components).forEach((comp) => {
                comp.updateTranslation();
            });
        });


        for (let i = 0; i < EAction.MAX; ++i) {
            const group = this._getGroup(i);
            const header = UIUtil.getElementById(`component_header_${group.id}`);

            group.label = this._getGroupHeadingLabel(i);
            header.innerHTML = MiscComponents.createGroupHeader(group.label);

            if (group.execButton !== undefined) {
                const newButtonLabel = this._getGroupButtonLabel(i);
                group.execButton.setLabel(newButtonLabel).updateLabel();
            }

            this._forEachComponent(i, (component) => {
                component.refresh();
            });
        }

        // Removed console notification for language change
    }

    /**
     * Rebuilds the HTML for all components in an action group.
     */
    public refreshComponents(action: EAction) {
        const group = this._getGroup(action);

        const element = document.getElementById(`subcomponents_${group.id}`);
        ASSERT(element !== null);

        element.innerHTML = this._getComponentsHTML(group);

        this._forEachComponent(action, (component) => {
            component.registerEvents();
            component.finalise();
        });
    }

    private _getComponentsHTML(group: Group) {
        let groupHTML = '';
        for (const elementName of group.componentOrder) {
            const element = group.components[elementName];
            ASSERT(element !== undefined, `No element for: ${elementName}`);
            groupHTML += element.generateHTML();
        }
        return groupHTML;
    }

    private _getGroupHTML(group: Group) {
        return `
            <div class="group-block" data-group="${group.id}">
                <div id="component_header_${group.id}">
                    ${MiscComponents.createGroupHeader(group.label)}
                </div>
                <div class="component-group" id="subcomponents_${group.id}">
                    ${this._getComponentsHTML(group)}
                </div>
                ${group.execButton?.generateHTML() ?? ''}
            </div>
        `;
    }

    public getActionButton(action: EAction) {
        const group = this._getGroup(action);
        return group.execButton;
    }

    public registerEvents() {
        HeaderComponent.Get.registerEvents();
        HeaderComponent.Get.finalise();

        for (let action = 0; action < EAction.MAX; ++action) {
            const group = this._getGroup(action);
            const container = document.getElementById(`subcomponents_${group.id}`);
            if (!container) {
                continue; // Skip groups not present in the DOM
            }

            this._forEachComponent(action, (component) => {
                component.registerEvents();
                component.finalise();
            });

            group.execButton?.registerEvents();
            group.execButton?.finalise();
        }

        // Register toolbar left
        for (const toolbarGroupName of this._toolbarLeft.groupsOrder) {
            const toolbarGroup = this._toolbarLeftDull[toolbarGroupName];
            for (const groupElementName of toolbarGroup.componentOrder) {
                const element = toolbarGroup.components[groupElementName];
                element.registerEvents();
                element.finalise();
            }
        }
        // Register toolbar right
        for (const toolbarGroupName of this._toolbarRight.groupsOrder) {
            const toolbarGroup = this._toolbarRightDull[toolbarGroupName];
            for (const groupElementName of toolbarGroup.componentOrder) {
                const element = toolbarGroup.components[groupElementName];
                element.registerEvents();
                element.finalise();
            }
        }

        // Hook up layer input and slider controls
        const layerInput = document.getElementById('layer-input') as HTMLInputElement | null;
        const layerSlider = document.getElementById('layer-slider') as HTMLInputElement | null;
        if (layerInput) {
            // Prevent toolbar click handling interfering with inputs
            layerInput.addEventListener('mousedown', (e) => e.stopPropagation());
            layerInput.addEventListener('click', (e) => e.stopPropagation());
            layerInput.addEventListener('change', () => {
                const v = parseInt(layerInput.value);
                if (!isNaN(v)) {
                    const base = Renderer.Get.getSliceMin();
                    Renderer.Get.setSliceHeight(base + v);
                }
            });
        }
        if (layerSlider) {
            layerSlider.addEventListener('mousedown', (e) => e.stopPropagation());
            layerSlider.addEventListener('click', (e) => e.stopPropagation());
            layerSlider.addEventListener('input', () => {
                const v = parseInt(layerSlider.value);
                if (!isNaN(v)) {
                    const base = Renderer.Get.getSliceMin();
                    Renderer.Get.setSliceHeight(base + v);
                    if (layerInput) layerInput.value = String(v);
                }
            });
        }
        const sliderItem = document.getElementById('layer-slider-item') as HTMLDivElement | null;
        if (sliderItem) {
            sliderItem.style.height = '260px';
            sliderItem.style.display = 'flex';
            sliderItem.style.alignItems = 'center';
        }
    }

    public get layout() {
        return this._ui;
    }

    public get layoutDull() {
        return this._uiDull;
    }

    /**
     * Enable a specific action.
     */
    public enable(action: EAction) {
        if (action < EAction.MAX) {
            const group = this._getGroup(action);
            const container = document.getElementById(`subcomponents_${group.id}`);
            if (!container) return; // Skip groups not present in DOM

            this._forEachComponent(action, (component) => {
                component.setEnabled(true);
            });
            group.execButton?.setEnabled(true);
        }
    }

    /**
     * Enable all actions up to and including a specific action.
     */
    public enableTo(action: EAction) {
        for (let i = 0; i <= action; ++i) {
            this.enable(i);
        }
    }

    /**
     * Disable a specific action and its dependent actions.
     */
    public disable(action: EAction) {
        for (let i = action; i < EAction.MAX; ++i) {
            const group = this._getGroup(i);
            const container = document.getElementById(`subcomponents_${group.id}`);
            if (!container) continue; // Skip groups not present in DOM

            this._forEachComponent(i, (component) => {
                component.setEnabled(false);
            });

            group.execButton?.setEnabled(false);
        }
    }

    /**
     * Disables all the actions.
     */
    public disableAll() {
        this.disable(EAction.Settings);
    }

    /**
     * Util function to get the `Group` associated with an `EAction`.
     */
    private _getGroup(action: EAction): Group {
        const key = this.uiOrder[action];
        return this._uiDull[key];
    }

    // Materials editing removed in simplified UI.
}
