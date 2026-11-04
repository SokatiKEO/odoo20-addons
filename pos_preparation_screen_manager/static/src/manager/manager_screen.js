/**
 * POS Preparation Screen Manager - Multi-Screen Read-Only Controller
 */
(function () {
    "use strict";

    function decodeHtml(html) {
        const txt = document.createElement("textarea");
        txt.innerHTML = html;
        return txt.value;
    }

    function parseConfig() {
        const scriptEl = document.getElementById("manager_config_data");
        if (scriptEl && scriptEl.textContent) {
            const raw = scriptEl.textContent.trim();
            try {
                return JSON.parse(raw);
            } catch (err) {
                try {
                    return JSON.parse(decodeHtml(raw));
                } catch (err2) {
                    console.error("Failed to parse manager_config_data:", err, err2);
                }
            }
        }
        if (window.ODOO_PDIS_MANAGER_CONFIG) {
            if (typeof window.ODOO_PDIS_MANAGER_CONFIG === "string") {
                try {
                    return JSON.parse(window.ODOO_PDIS_MANAGER_CONFIG);
                } catch {
                    // ignore
                }
            } else if (typeof window.ODOO_PDIS_MANAGER_CONFIG === "object") {
                return window.ODOO_PDIS_MANAGER_CONFIG;
            }
        }
        return {
            id: 0,
            name: "Manager Preparation Screen",
            default_view_mode: "split",
            grid_columns: "auto",
            selected_display_ids: [],
            all_displays: [],
            backend_url: "/odoo/action-pos_enterprise.action_preparation_display",
        };
    }

    const config = parseConfig();

    const storageKey = `odoo_pdis_manager_${config.id}`;
    const savedState = loadSavedState();

    const isMobileViewport = window.matchMedia("(max-width: 767.98px)").matches;
    const allDisplaysMap = new Map(config.all_displays.map((d) => [d.id, d]));

    let selectedIds = resolveInitialSelectedIds();
    let viewMode = isMobileViewport
        ? "tabs"
        : config.default_view_mode || savedState.viewMode || "split";
    if (viewMode !== "split" && viewMode !== "tabs") {
        viewMode = "split";
    }
    let gridColumns = config.grid_columns || savedState.gridColumns || "auto";
    let activeTabId = selectedIds[0] || null;
    let draftSelectedIds = new Set(selectedIds);

    // Track live order counts per display ID
    const liveStats = new Map();
    for (const d of config.all_displays) {
        liveStats.set(d.id, {
            orderCount: d.order_count || 0,
            cardCount: d.order_count || 0,
        });
    }

    // Cache mounted panel DOM nodes by displayId so switching modes/tabs never reloads iframes
    const mountedPanels = new Map();

    // DOM Elements
    const tabsNavEl = document.getElementById("mgr_tabs_nav");
    const containerEl = document.getElementById("mgr_screens_container");
    const btnModeSplit = document.getElementById("btn_mode_split");
    const btnModeTabs = document.getElementById("btn_mode_tabs");
    const selectGridCols = document.getElementById("select_grid_cols");
    const btnOpenModal = document.getElementById("btn_open_screens_modal");
    const badgeSelectedCount = document.getElementById("badge_selected_count");
    const btnToggleTheme = document.getElementById("btn_toggle_theme");
    const btnRefreshAll = document.getElementById("btn_refresh_all");
    const btnExitManager = document.getElementById("btn_exit_manager");

    // Modal Elements
    const modalBackdropEl = document.getElementById("mgr_screens_modal");
    const checklistEl = document.getElementById("mgr_screens_checklist");
    const btnCloseModal = document.getElementById("btn_close_modal");
    const btnCancelModal = document.getElementById("btn_cancel_modal");
    const btnApplyScreens = document.getElementById("btn_apply_screens");
    const btnSelectAll = document.getElementById("btn_select_all_screens");
    const btnClearAll = document.getElementById("btn_clear_all_screens");

    function loadSavedState() {
        try {
            const raw = localStorage.getItem(storageKey);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }

    function saveLocalState() {
        try {
            localStorage.setItem(
                storageKey,
                JSON.stringify({
                    selectedIds,
                    viewMode,
                    gridColumns,
                })
            );
        } catch {
            // Ignore storage quota errors
        }
    }

    function resolveInitialSelectedIds() {
        if (
            Array.isArray(config.selected_display_ids) &&
            config.selected_display_ids.length > 0
        ) {
            const validConfig = config.selected_display_ids.filter((id) =>
                allDisplaysMap.has(id)
            );
            if (validConfig.length > 0) {
                return validConfig;
            }
        }
        if (
            Array.isArray(savedState.selectedIds) &&
            savedState.selectedIds.length > 0
        ) {
            const validSaved = savedState.selectedIds.filter((id) =>
                allDisplaysMap.has(id)
            );
            if (validSaved.length > 0) {
                return validSaved;
            }
        }
        return config.all_displays.map((d) => d.id);
    }

    async function persistServerConfig() {
        saveLocalState();
        if (!config.id) {
            return;
        }
        try {
            await fetch("/pos_preparation_display/manager/save_config", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "call",
                    params: {
                        manager_id: config.id,
                        display_ids: selectedIds,
                        view_mode: viewMode,
                        grid_columns: gridColumns,
                    },
                    id: Date.now(),
                }),
            });
        } catch {
            // Local state is already saved; ignore network errors
        }
    }

    function createPanelElement(display) {
        const panel = document.createElement("section");
        panel.className = "o_pdis_mgr_panel";
        panel.dataset.displayId = String(display.id);

        const header = document.createElement("div");
        header.className = "o_pdis_mgr_panel_header";

        const titleWrap = document.createElement("div");
        titleWrap.className = "o_pdis_mgr_panel_title_wrap";

        const title = document.createElement("span");
        title.className = "o_pdis_mgr_panel_title";
        title.textContent = display.name;

        const badge = document.createElement("span");
        badge.className = "o_pdis_mgr_panel_badge";
        badge.dataset.role = "panel-count";
        const count = liveStats.get(display.id)?.orderCount ?? 0;
        badge.textContent = `${count} active`;

        titleWrap.appendChild(title);
        titleWrap.appendChild(badge);

        const actions = document.createElement("div");
        actions.className = "o_pdis_mgr_panel_actions";

        // const focusBtn = document.createElement("button");
        // focusBtn.type = "button";
        // focusBtn.className = "o_mgr_btn o_mgr_btn_sm";
        // focusBtn.title = "Focus this screen in full tab view";
        // focusBtn.textContent = "Focus";
        // focusBtn.addEventListener("click", () => {
        //     activeTabId = display.id;
        //     viewMode = "tabs";
        //     renderLayout();
        //     saveLocalState();
        // });

        // actions.appendChild(focusBtn);
        header.appendChild(titleWrap);
        header.appendChild(actions);

        const iframe = document.createElement("iframe");
        iframe.className = "o_pdis_mgr_iframe";
        iframe.src = display.embed_url;
        iframe.title = `${display.name} (Read-Only)`;
        iframe.setAttribute("loading", "eager");

        panel.appendChild(header);
        panel.appendChild(iframe);
        return panel;
    }

    function renderTabs() {
        if (!tabsNavEl) {
            return;
        }
        tabsNavEl.innerHTML = "";
        if (badgeSelectedCount) {
            badgeSelectedCount.textContent = String(selectedIds.length);
        }

        for (const id of selectedIds) {
            const display = allDisplaysMap.get(id);
            if (!display) {
                continue;
            }
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className =
                "o_mgr_tab" +
                (viewMode === "tabs" && activeTabId === id ? " active" : "");
            btn.dataset.tabDisplayId = String(id);

            const nameSpan = document.createElement("span");
            nameSpan.textContent = display.name;

            const countSpan = document.createElement("span");
            countSpan.className = "o_mgr_tab_count";
            countSpan.dataset.role = "tab-count";
            countSpan.textContent = String(
                liveStats.get(id)?.orderCount ?? 0
            );

            btn.appendChild(nameSpan);
            btn.appendChild(countSpan);

            btn.addEventListener("click", () => {
                activeTabId = id;
                if (viewMode === "split") {
                    const panel = mountedPanels.get(id);
                    if (panel) {
                        panel.scrollIntoView({
                            behavior: "smooth",
                            block: "nearest",
                        });
                    }
                } else {
                    renderLayout();
                }
            });

            tabsNavEl.appendChild(btn);
        }
    }

    function updateBadgeElements(displayId) {
        const count = liveStats.get(displayId)?.orderCount ?? 0;
        const tabBtn = tabsNavEl?.querySelector(
            `[data-tab-display-id="${displayId}"] [data-role="tab-count"]`
        );
        if (tabBtn) {
            tabBtn.textContent = String(count);
        }
        const panel = mountedPanels.get(displayId);
        if (panel) {
            const panelBadge = panel.querySelector('[data-role="panel-count"]');
            if (panelBadge) {
                panelBadge.textContent = `${count} active`;
            }
        }
    }

    function renderLayout() {
        if (!containerEl) {
            return;
        }
        if (!selectedIds.includes(activeTabId)) {
            activeTabId = selectedIds[0] || null;
        }

        // Update view mode buttons
        btnModeSplit?.classList.toggle("active", viewMode === "split");
        btnModeTabs?.classList.toggle("active", viewMode === "tabs");
        if (selectGridCols) {
            selectGridCols.value = gridColumns;
            selectGridCols.style.display = viewMode === "split" ? "" : "none";
        }

        // Update viewport classes
        containerEl.className = `o_pdis_mgr_Viewport mode-${viewMode} cols-${gridColumns}`;

        // Remove panels that are no longer selected
        for (const [id, panelEl] of mountedPanels.entries()) {
            if (!selectedIds.includes(id)) {
                panelEl.remove();
                mountedPanels.delete(id);
            }
        }

        // Remove any empty state placeholder
        const oldEmpty = containerEl.querySelector(".o_pdis_mgr_empty");
        if (oldEmpty) {
            oldEmpty.remove();
        }

        if (selectedIds.length === 0) {
            const emptyDiv = document.createElement("div");
            emptyDiv.className = "o_pdis_mgr_empty";
            const h2 = document.createElement("h2");
            h2.textContent = "No Preparation Screens Selected";
            const p = document.createElement("p");
            p.textContent =
                "Click the '+ Screens' button above to choose which preparation screens to monitor.";
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "o_mgr_btn o_mgr_btn_primary";
            btn.textContent = "+ Select Preparation Screens";
            btn.addEventListener("click", openScreensModal);
            emptyDiv.appendChild(h2);
            emptyDiv.appendChild(p);
            emptyDiv.appendChild(btn);
            containerEl.appendChild(emptyDiv);
            renderTabs();
            return;
        }

        // Ensure all selected panels are mounted and in order
        for (const id of selectedIds) {
            const display = allDisplaysMap.get(id);
            if (!display) {
                continue;
            }
            let panel = mountedPanels.get(id);
            if (!panel) {
                panel = createPanelElement(display);
                mountedPanels.set(id, panel);
                containerEl.appendChild(panel);
            } else if (panel.parentElement !== containerEl) {
                containerEl.appendChild(panel);
            }

            if (viewMode === "tabs") {
                panel.classList.toggle("hidden-tab", id !== activeTabId);
            } else {
                panel.classList.remove("hidden-tab");
            }
        }

        renderTabs();
    }

    function openScreensModal() {
        draftSelectedIds = new Set(selectedIds);
        renderChecklist();
        modalBackdropEl?.classList.remove("hidden");
    }

    function closeScreensModal() {
        modalBackdropEl?.classList.add("hidden");
    }

    function renderChecklist() {
        checklistEl.innerHTML = "";
        if (config.all_displays.length === 0) {
            const msg = document.createElement("p");
            msg.textContent =
                "No Preparation Displays exist yet. Create them in Point of Sale > Preparation Display.";
            checklistEl.appendChild(msg);
            return;
        }

        for (const display of config.all_displays) {
            const isChecked = draftSelectedIds.has(display.id);
            const label = document.createElement("label");
            label.className =
                "o_mgr_screen_option" + (isChecked ? " selected" : "");

            const left = document.createElement("div");
            left.className = "o_mgr_screen_option_left";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = isChecked;
            checkbox.addEventListener("change", () => {
                if (checkbox.checked) {
                    draftSelectedIds.add(display.id);
                    label.classList.add("selected");
                } else {
                    draftSelectedIds.delete(display.id);
                    label.classList.remove("selected");
                }
            });

            const info = document.createElement("div");
            const nameDiv = document.createElement("div");
            nameDiv.className = "o_mgr_screen_option_name";
            nameDiv.textContent = display.name;

            const metaDiv = document.createElement("div");
            metaDiv.className = "o_mgr_screen_option_meta";
            const stagesText =
                display.stages && display.stages.length
                    ? `Stages: ${display.stages.join(" → ")}`
                    : "All Stages";
            const categText =
                display.categories && display.categories.length
                    ? ` • Categories: ${display.categories.join(", ")}`
                    : " • All Categories";
            metaDiv.textContent = stagesText + categText;

            info.appendChild(nameDiv);
            info.appendChild(metaDiv);
            left.appendChild(checkbox);
            left.appendChild(info);

            const badge = document.createElement("span");
            badge.className = "o_pdis_mgr_panel_badge";
            const count = liveStats.get(display.id)?.orderCount ?? display.order_count ?? 0;
            badge.textContent = `${count} active`;

            label.appendChild(left);
            label.appendChild(badge);
            checklistEl.appendChild(label);
        }
    }

    // Event Listeners
    btnModeSplit?.addEventListener("click", () => {
        viewMode = "split";
        renderLayout();
        persistServerConfig();
    });

    btnModeTabs?.addEventListener("click", () => {
        viewMode = "tabs";
        renderLayout();
        persistServerConfig();
    });

    selectGridCols?.addEventListener("change", () => {
        gridColumns = selectGridCols.value;
        renderLayout();
        persistServerConfig();
    });

    btnOpenModal?.addEventListener("click", openScreensModal);
    btnCloseModal?.addEventListener("click", closeScreensModal);
    btnCancelModal?.addEventListener("click", closeScreensModal);

    modalBackdropEl?.addEventListener("click", (ev) => {
        if (ev.target === modalBackdropEl) {
            closeScreensModal();
        }
    });

    btnSelectAll?.addEventListener("click", () => {
        draftSelectedIds = new Set(config.all_displays.map((d) => d.id));
        renderChecklist();
    });

    btnClearAll?.addEventListener("click", () => {
        draftSelectedIds.clear();
        renderChecklist();
    });

    btnApplyScreens?.addEventListener("click", () => {
        selectedIds = config.all_displays
            .map((d) => d.id)
            .filter((id) => draftSelectedIds.has(id));
        closeScreensModal();
        renderLayout();
        persistServerConfig();
    });

    btnToggleTheme?.addEventListener("click", () => {
        const isDark =
            document.documentElement.getAttribute("data-theme") === "dark";
        const nextTheme = isDark ? "light" : "dark";
        document.cookie = `prep_theme=${nextTheme}; path=/; max-age=31536000; SameSite=Lax`;
        window.location.reload();
    });

    btnRefreshAll?.addEventListener("click", () => {
        for (const panel of mountedPanels.values()) {
            const iframe = panel.querySelector("iframe");
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.location.reload();
            }
        }
    });

    btnExitManager?.addEventListener("click", () => {
        window.location.href =
            config.backend_url ||
            "/odoo/action-pos_preparation_screen_manager.action_pos_prep_screen_manager";
    });

    // Listen for live stats from embedded Preparation Display iframes
    window.addEventListener("message", (event) => {
        if (event.origin !== window.location.origin) {
            return;
        }
        const data = event.data;
        if (data && data.type === "PDIS_MANAGER_SCREEN_STATS" && data.displayId) {
            liveStats.set(Number(data.displayId), {
                orderCount: Number(data.orderCount || 0),
                cardCount: Number(data.cardCount || 0),
            });
            updateBadgeElements(Number(data.displayId));
        }
    });

    // Initial render
    renderLayout();
})();

