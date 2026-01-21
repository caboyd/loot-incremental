/**
 * @module
 * @hidden
 */
import { main } from "data/projEntry";
import prestige from "data/layers/prestige";
import { createCumulativeConversion } from "features/conversion";
import { createHotkey } from "features/hotkey";
import { createReset } from "features/reset";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource } from "features/resources/resource";
import { createResourceTooltip } from "features/trees/tree";
import { createLayer } from "game/layers";
import type { DecimalSource } from "util/bignum";
import { render } from "util/vue";
import { addTooltip } from "wrappers/tooltips/tooltip";
import { createLayerTreeNode, createResetButton } from "../common";
import { createUpgrade } from "features/clickables/upgrade";
import { createCostRequirement } from "game/requirements";
import { noPersist } from "game/persistence";
import { createParticles } from "features/particles/particles";

import { createAction } from "features/clickables/action";
import Decimal from "util/bignum";
import { ref, unref } from "vue";
import { Texture } from "@pixi/core";
import { Emitter } from "@pixi/particle-emitter";

const id = "t";
const layer = createLayer(id, L => {
    const name = "Test";
    const color = "#1399dcff";
    const gold = createResource<DecimalSource>(0, "gold");
    const xp = createResource<DecimalSource>(0, "xp");

    const particles = createParticles(() => ({
        style: {
            position: "absolute",
            inset: "0",
            pointerEvents: "none"
        }
    }));
    const chestDivRef = ref<HTMLElement | null>(null);
    const chest = createAction(() => ({
        duration: 10,
        autoStart: false,

        display: () => {
            return (
                <div
                    ref={chestDivRef} // <--- attach the ref here
                    id="chest"
                    style={{
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        background: "none"
                    }}
                >
                    <img src="/assets/chest1.png" alt="Chest Icon" style={{ width: "64px" }} />
                    <span
                        style={{
                            color: "white",
                            fontSize: "12px",
                            fontWeight: "bold",
                            textShadow: "0 0 2px black"
                        }}
                    >
                        {Decimal.gte(chest.progress.value, unref(chest.duration))
                            ? "Loot Ready!"
                            : `${Decimal.sub(unref(chest.duration), chest.progress.value).toFixed(1)}s`}
                    </span>
                </div>
            );
        },
        barOptions: {
            height: 4
        },
        onClick: () => {
            const randomAmount = Math.floor(Math.random() * 10) + 1;
            gold.value = Decimal.add(gold.value, randomAmount);
            if (unlock_exp.bought.value) {
                xp.value = Decimal.add(xp.value, Math.floor(randomAmount / 10));
            }
        }
    }));

    const unlock_exp = createUpgrade(() => ({
        requirements: createCostRequirement(() => ({
            resource: noPersist(gold),
            cost: 100
        })),
        display: {
            description: "Unlock XP rewards"
        }
    }));

    const conversion = createCumulativeConversion(() => ({
        formula: x => x.div(4),
        baseResource: prestige.points,
        gainResource: gold
    }));

    const reset = createReset(() => ({
        thingsToReset: (): Record<string, unknown>[] => [layer]
    }));

    const treeNode = createLayerTreeNode(() => ({
        layerID: id,
        color,
        reset
    }));
    const tooltip = addTooltip(treeNode, () => ({
        display: createResourceTooltip(gold),
        pinnable: true
    }));

    const resetButton = createResetButton(() => ({
        conversion,
        tree: main.tree,
        treeNode
    }));

    const hotkey = createHotkey(() => ({
        description: "Reset for test points",
        key: "x",
        onPress: resetButton.onClick!
    }));

    let myEmitter: Emitter | null = null;

    // create the emitter
    particles
        .addEmitter({
            lifetime: { min: 1, max: 1.5 },
            frequency: 0.04,
            emitterLifetime: -1,
            maxParticles: 100,
            pos: { x: 0, y: 0 }, // initial placeholder
            autoUpdate: true,
            emit: true,
            behaviors: [
                {
                    type: "alpha",
                    config: {
                        alpha: {
                            list: [
                                { value: 0.8, time: 0 }, // start
                                { value: 0.801, time: 1 } // end (same value, different time)
                            ]
                        }
                    }
                },
                {
                    type: "scale",
                    config: {
                        scale: {
                            list: [
                                { value: 0.6, time: 0 },
                                { value: 0.1, time: 1 }
                            ]
                        }
                    }
                },
                {
                    type: "color",
                    config: {
                        color: {
                            list: [
                                { value: "ffffff", time: 0 },
                                { value: "ffffff", time: 0.3 },
                                { value: "ff0000", time: 1 }
                            ]
                        }
                    }
                },
                {
                    type: "moveSpeed",
                    config: {
                        speed: {
                            list: [
                                { value: 150, time: 0 },
                                { value: 0, time: 1 }
                            ]
                        }
                    }
                },
                {
                    type: "rotationStatic",
                    config: {
                        min: 0, // degrees
                        max: 360 // small spread around forward
                    }
                },
                { type: "textureSingle", config: { texture: Texture.WHITE } }
            ]
        })
        .then(emitter => {
            myEmitter = emitter;
            if (!chestDivRef.value || !particles.app.value) return;

            // get the chest's position relative to the particles canvas
            const chestBounds = chestDivRef.value.getBoundingClientRect();
            const canvasBounds = particles.app.value?.view.getBoundingClientRect();
            if (!canvasBounds) return;

            emitter.spawnPos.x = chestBounds.left + chestBounds.width / 2 - canvasBounds.left;
            emitter.spawnPos.y = chestBounds.top + chestBounds.height / 2 - canvasBounds.top;
        });

    L.on("update", diff => {
        const emitterActive = Decimal.gte(chest.progress.value, unref(chest.duration));
        if (myEmitter) {
            myEmitter.emit = emitterActive; // turns emission on/off
            if (emitterActive) {
                myEmitter.emitNow();
            } else {
                myEmitter.cleanup();
            }
        }
    });

    return {
        name,
        color,
        gold,
        xp,
        tooltip,
        particles,
        features: [chest],
        double_upgrade: unlock_exp,

        display: () => (
            <div style="display: flex; flex-direction: column; align-items: center;">
                <div>
                    <MainDisplay resource={gold} color={color} />
                    <MainDisplay resource={xp} color={color} />
                </div>
                {render(particles)}

                <div
                    class={{
                        "chest-ready": Decimal.gte(chest.progress.value, unref(chest.duration))
                    }}
                >
                    {render(chest)}
                </div>
                <div style="display: flex; flex-direction: row; align-items: center;">
                    {render(resetButton)}
                    {render(unlock_exp)}
                </div>
            </div>
        ),
        treeNode,
        hotkey
    };
});

export default layer;
