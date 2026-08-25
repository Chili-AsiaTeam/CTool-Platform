let currentData = null;
        let draggedElement = null;
		let originalBackup = null; // 用于存储最初上传或成功解析时的 JSON 备份

        const jsonInput = document.getElementById("json-input");
        const btnParse = document.getElementById("btn-parse");
        const btnClear = document.getElementById("btn-clear");
        const btnCopy = document.getElementById("btn-copy");
        const btnDownload = document.getElementById("btn-download");
        const btnUploadTrigger = document.getElementById("btn-upload-trigger");
        const fileInput = document.getElementById("file-input");
        const treeRoot = document.getElementById("tree-root");
        const statusMsg = document.getElementById("status-msg");
		const btnReset = document.getElementById("btn-reset");
                 
        // 初始化加载
        function init() {
            setupDragAndDrop();
            setupFileHandlers();
			updateButtonStates();
        }
		
		// 刷新控制按钮的是否可用状态
		function updateButtonStates() {
		    const hasData = currentData !== null;
		    btnReset.disabled = !hasData;
		    // btnCopy.disabled = !hasData;
		    btnDownload.disabled = !hasData;
		}

        // 解析并渲染树结构
        function renderTree() {
            if (!currentData || !currentData.layouts) {
                treeRoot.innerHTML = `
                    <div style="color: var(--text-muted); font-size: 0.9rem; text-align: center; margin-top: 50px;" id="placeholder-msg">
                        Please paste JSON data on the right panel, or click “Upload JSON” to import a file and initialize the view。
                    </div>
                `;
                return;
            }

            treeRoot.innerHTML = "";
            
            // 找到没有parentId或者为top级的根节点
            const rootLayouts = currentData.layouts.filter(l => !l.parentId || l.type === 'top');

            if (rootLayouts.length === 0) {
                treeRoot.innerHTML = `<div style="color: var(--danger-red); font-size: 0.9rem; text-align: center; margin-top: 50px;">未发现有效的顶层或根节点布局 (layouts)</div>`;
                return;
            }

            rootLayouts.forEach(rootLayout => {
                const rootEl = createNodeElement(rootLayout, true);
                treeRoot.appendChild(rootEl);
            });
        }

        // 递归创建DOM节点
        function createNodeElement(layout, isRoot = false) {
            const node = document.createElement("div");
            node.className = `tree-node ${isRoot ? 'root-node' : ''}`;
            node.dataset.id = layout.id;
            node.dataset.parentId = layout.parentId || "";

            const header = document.createElement("div");
            header.className = "node-header";
            
            const hasChildren = layout.childLayouts && layout.childLayouts.length > 0;
            
            // 1. 箭头/文件指示图标
            const arrowSpan = document.createElement("span");
            arrowSpan.className = "icon";
            if (hasChildren) {
                arrowSpan.innerHTML = "▼";
                arrowSpan.classList.add("arrow-icon");
            } else {
                arrowSpan.innerHTML = "📄";
                arrowSpan.style.color = "var(--text-muted)";
            }
            header.appendChild(arrowSpan);

            // 2. 文件夹/图层小图标
            const folderSpan = document.createElement("span");
            folderSpan.className = "icon";
            folderSpan.innerHTML = isRoot ? "🔲" : (hasChildren ? "📁" : "🔹");
            header.appendChild(folderSpan);

            // 3. 节点文字
            const textSpan = document.createElement("span");
            textSpan.innerText = layout.name;
            header.appendChild(textSpan);
			
			
			// 设置可拖拽和置顶置底快捷按钮
			if (!isRoot) {
			    header.classList.add("draggable");
			    header.setAttribute("draggable", "true");
			
			    // 创建置顶、置底动作按钮
			    const actionContainer = document.createElement("div");
			    actionContainer.className = "action-buttons";
			
			    const topBtn = document.createElement("button");
			    topBtn.className = "mini-btn";
			    topBtn.innerText = "Top";
			    topBtn.title = "Move to the top of this directory";
			    topBtn.addEventListener("click", (e) => {
			        e.stopPropagation();
			        moveNodeToLimit(node, true);
			    });
			
			    const bottomBtn = document.createElement("button");
			    bottomBtn.className = "mini-btn";
			    bottomBtn.innerText = "Bottom";
			    bottomBtn.title = "Move to the bottom of this directory";
			    bottomBtn.addEventListener("click", (e) => {
			        e.stopPropagation();
			        moveNodeToLimit(node, false);
			    });
			
			    actionContainer.appendChild(topBtn);
			    actionContainer.appendChild(bottomBtn);
			    header.appendChild(actionContainer);
			}
			
			node.appendChild(header);
			
			
			

            // 设置可拖拽性
            if (!isRoot) {
                header.classList.add("draggable");
                header.setAttribute("draggable", "true");
            }

            node.appendChild(header);

            // 创建子节点容器
            if (hasChildren) {
                const childrenContainer = document.createElement("div");
                childrenContainer.className = "node-children";
                childrenContainer.dataset.parentId = layout.id;

                // 按照 childLayouts 的存储顺序渲染
                layout.childLayouts.forEach(childId => {
                    const childLayout = currentData.layouts.find(l => l.id === childId);
                    if (childLayout) {
                        const childNode = createNodeElement(childLayout, false);
                        childrenContainer.appendChild(childNode);
                    }
                });

                node.appendChild(childrenContainer);

                // 点击折叠/打开功能
                arrowSpan.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const collapsed = childrenContainer.style.display === "none";
                    childrenContainer.style.display = collapsed ? "block" : "none";
                    arrowSpan.classList.toggle("collapsed", !collapsed);
                });
            }

            return node;
        }


 // 置顶 / 置底逻辑
        function moveNodeToLimit(node, isTop) {
            const parentId = node.dataset.parentId;
            const container = node.parentElement; // 获取 node-children 容器
            
            if (!container) return;

            if (isTop) {
                // 置顶：插入到容器的首个子节点之前
                container.insertBefore(node, container.firstChild);
            } else {
                // 置底：直接 appendChild 到末尾
                container.appendChild(node);
            }

            // 更新底层数据和 JSON 文件
            updateJSONOrder(parentId, container);
        }


        // 配置拖拽事件及限制逻辑
        function setupDragAndDrop() {
            treeRoot.addEventListener("dragstart", (e) => {
                const targetHeader = e.target.closest(".node-header.draggable");
                if (!targetHeader) return;

                draggedElement = targetHeader.parentElement;
                targetHeader.classList.add("dragging");
                
                const parentId = draggedElement.dataset.parentId;
                e.dataTransfer.setData("text/plain", draggedElement.dataset.id);
                e.dataTransfer.setData("parent-id", parentId);
                e.dataTransfer.effectAllowed = "move";
            });

            treeRoot.addEventListener("dragend", (e) => {
                const targetHeader = e.target.closest(".node-header.draggable");
                if (targetHeader) {
                    targetHeader.classList.remove("dragging");
                }
                
                document.querySelectorAll(".node-header").forEach(el => {
                    el.classList.remove("drag-indicator-above", "drag-indicator-below");
                });
                draggedElement = null;
            });

            treeRoot.addEventListener("dragover", (e) => {
                e.preventDefault();
                if (!draggedElement) return;

                const targetHeader = e.target.closest(".node-header.draggable");
                if (!targetHeader) return;

                const targetNode = targetHeader.parentElement;
                
                // 【严格限制】：只能在同级 parentId 相同的容器内进行拖动排序
                if (targetNode.dataset.parentId !== draggedElement.dataset.parentId) {
                    e.dataTransfer.dropEffect = "none";
                    return; 
                }

                e.dataTransfer.dropEffect = "move";

                const rect = targetHeader.getBoundingClientRect();
                const relativeY = e.clientY - rect.top;
                
                document.querySelectorAll(".node-header").forEach(el => {
                    el.classList.remove("drag-indicator-above", "drag-indicator-below");
                });

                if (relativeY < rect.height / 2) {
                    targetHeader.classList.add("drag-indicator-above");
                } else {
                    targetHeader.classList.add("drag-indicator-below");
                }
            });

            treeRoot.addEventListener("drop", (e) => {
                e.preventDefault();
                if (!draggedElement) return;

                const targetHeader = e.target.closest(".node-header.draggable");
                if (!targetHeader) return;

                const targetNode = targetHeader.parentElement;
                const parentId = targetNode.dataset.parentId;

                // 校验父级 ID
                if (parentId !== draggedElement.dataset.parentId) {
                    return;
                }

                const rect = targetHeader.getBoundingClientRect();
                const relativeY = e.clientY - rect.top;
                const insertAbove = relativeY < rect.height / 2;

                const container = targetNode.parentElement;

                if (insertAbove) {
                    container.insertBefore(draggedElement, targetNode);
                } else {
                    container.insertBefore(draggedElement, targetNode.nextSibling);
                }

                targetHeader.classList.remove("drag-indicator-above", "drag-indicator-below");

                // 更新底层 JSON 并更新文本区域
                updateJSONOrder(parentId, container);
            });
        }

        // DOM 顺序映射到数据源
        function updateJSONOrder(parentId, container) {
            const newOrderIds = Array.from(container.children)
                .map(node => node.dataset.id)
                .filter(id => id !== undefined);

            const parentLayout = currentData.layouts.find(l => l.id === parentId);
            if (parentLayout) {
                parentLayout.childLayouts = newOrderIds;
                jsonInput.value = JSON.stringify(currentData, null, 2);
                showStatus("数据排列顺序已同步！");
            }
        }

        // 文件读写控制
        function setupFileHandlers() {
            btnUploadTrigger.addEventListener("click", () => {
                fileInput.click();
            });

            fileInput.addEventListener("change", (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const parsed = JSON.parse(event.target.result);
                        if (!parsed.layouts || !Array.isArray(parsed.layouts)) {
                            throw new Error("格式不正确：JSON 必须包含 'layouts' 数组。");
                        }
                        currentData = parsed;
						
						// 深拷贝原始导入文件作为“重置备份”
						originalBackup = JSON.parse(JSON.stringify(parsed));
						
                        jsonInput.value = JSON.stringify(currentData, null, 2);
                        renderTree();
						 updateButtonStates();
                        showStatus(`已加载文件: ${file.name}`);
                    } catch (err) {
                        showStatus("导入错误: " + err.message, true);
                    }
                    fileInput.value = "";
                };
                reader.readAsText(file);
            });

            btnDownload.addEventListener("click", () => {
                if (!jsonInput.value.trim()) {
                    showStatus("没有可下载的 JSON 数据", true);
                    return;
                }
                try {
                    const dataToDownload = JSON.parse(jsonInput.value);
                    const blob = new Blob([JSON.stringify(dataToDownload, null, 2)], { type: "application/json" });
                    
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = dataToDownload.selectedLayoutId ? `layout_${dataToDownload.selectedLayoutId}.json` : "layout_updated.json";
                    document.body.appendChild(a);
                    a.click();
                    
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showStatus("下载完毕！");
                } catch (e) {
                    showStatus("无法下载，请保证编辑器内为合法 JSON", true);
                }
            });
        }

        // 状态文字提示
        function showStatus(text, isError = false) {
            statusMsg.innerText = text;
            statusMsg.style.color = isError ? "var(--danger-red)" : "#4ec9b0";
            setTimeout(() => { statusMsg.innerText = ""; }, 3000);
        }

        // 其他按钮绑定
        // btnParse.addEventListener("click", () => {
        //     const val = jsonInput.value.trim();
        //     if (!val) {
        //         showStatus("文本框内容为空", true);
        //         return;
        //     }
        //     try {
        //         const parsed = JSON.parse(val);
        //         if (!parsed.layouts || !Array.isArray(parsed.layouts)) {
        //             throw new Error("格式不正确：必须包含 'layouts' 数组。");
        //         }
        //         currentData = parsed;
        //         renderTree();
        //         showStatus("应用成功！");
        //     } catch (e) {
        //         showStatus("格式错误: " + e.message, true);
        //     }
        // });

 // 🔄 一键恢复初始排序
        btnReset.addEventListener("click", () => {
			
            if (!originalBackup) {
                showStatus("没有可用的备份状态进行重置", true);
                return;
            }
            // 使用备份覆盖当前数据
            currentData = JSON.parse(JSON.stringify(originalBackup));
            jsonInput.value = JSON.stringify(currentData, null, 2);
            renderTree();
            showStatus("已重置回初始导入时的排序！");
        });



        btnClear.addEventListener("click", () => {
            currentData = null;
            jsonInput.value = "";
            renderTree();
			 updateButtonStates();
            showStatus("已清空");
        });

        // btnCopy.addEventListener("click", () => {
        //     if (!jsonInput.value) {
        //         showStatus("内容为空，无法复制", true);
        //         return;
        //     }
        //     navigator.clipboard.writeText(jsonInput.value).then(() => {
        //         showStatus("复制成功！");
        //     }).catch(() => {
        //         showStatus("复制失败", true);
        //     });
        // });

        window.addEventListener("DOMContentLoaded", init);