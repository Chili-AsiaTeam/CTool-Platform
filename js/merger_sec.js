let fileCounter = 1;

    // 动态添加输入框
    function addFileInput() {
        fileCounter++;
        const currentId = fileCounter;
        
        const fileList = document.getElementById('file-list');
        const div = document.createElement('div');
        div.className = 'file-group';
        div.id = `group-${currentId}`;
        
        div.innerHTML = `
            <div class="file-info">
                <label>Sub-template ${currentId}</label>
                <input type="file" class="json-input" accept=".json">
            </div>
            <button class="btn btn-remove" onclick="removeFileInput(${currentId})">Delete</button>
        `;
        
        fileList.appendChild(div);
    }

    // 移除指定的输入框
    function removeFileInput(id) {
        const el = document.getElementById(`group-${id}`);
        if(el) { el.remove(); }
    }

    // 显示状态信息
    function showStatus(message, isError = false) {
        const statusEl = document.getElementById('status');
        statusEl.textContent = message;
        statusEl.className = isError ? 'error' : 'success';
    }

    // 读取文件内容 (Promise)
    async function readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = e => reject(e);
            reader.readAsText(file);
        });
    }

    // 数组去重合并 (按 id)
    function mergeArraysById(arr1, arr2) {
        const result = [...(arr1 || [])];
        const ids = new Set(result.map(item => item.id));
        
        for (const item of (arr2 || [])) {
            if (!ids.has(item.id)) {
                result.push(item);
                ids.add(item.id);
            }
        }
        return result;
    }

    // 核心：将单个 srcJson 合并到 baseJson 中
    function mergeSingleJson(baseJson, srcJson) {
        // 1. 记录最后一个子模板的选中 Layout
        baseJson.selectedLayoutId = srcJson.selectedLayoutId;

        // 2. 合并 Pages 里的 Frames (图层组件)
        if (baseJson.pages?.[0] && srcJson.pages?.[0]) {
            baseJson.pages[0].frames = mergeArraysById(baseJson.pages[0].frames, srcJson.pages[0].frames);
        }

        // 3. 核心：合并 Layouts (布局树)
        const baseRoot = baseJson.layouts.find(l => l.type === 'top');
        const srcRoot = srcJson.layouts.find(l => l.type === 'top');
        
        if (baseRoot && srcRoot) {
            // 合并 Top 层的 frameProperties
            baseRoot.frameProperties = mergeArraysById(baseRoot.frameProperties, srcRoot.frameProperties);
            
            // 找到第二层容器 
            const baseLevel2 = baseJson.layouts.find(l => l.parentId === baseRoot.id);
            const srcLevel2 = srcJson.layouts.find(l => l.parentId === srcRoot.id);

            if (baseLevel2 && srcLevel2) {
                // 将 src 的子布局注册到 base 的子布局列表中去重合并
                baseLevel2.childLayouts = [...new Set([...baseLevel2.childLayouts, ...srcLevel2.childLayouts])];

                // 提取 src 中所有的底层布局 (排除了 src 的 top 和 den)
                const layoutsToAdd = srcJson.layouts.filter(l => l.id !== srcRoot.id && l.id !== srcLevel2.id);

                // 更新归属关系：将原来归属 srcLevel2 的布局，重新挂载到 baseLevel2 下
                layoutsToAdd.forEach(l => {
                    if (l.parentId === srcLevel2.id) {
                        l.parentId = baseLevel2.id;
                    }
                });

                // 将转换好关系的布局追加到总布局列表中 (并利用 id 去重，防止同一子模板重复导入)
                baseJson.layouts = mergeArraysById(baseJson.layouts, layoutsToAdd);
            }
        }

        // 4. 合并 BrandKit 设定
        if (baseJson.brandKit && srcJson.brandKit) {
            baseJson.brandKit.colors = mergeArraysById(baseJson.brandKit.colors, srcJson.brandKit.colors);
            baseJson.brandKit.gradients = mergeArraysById(baseJson.brandKit.gradients, srcJson.brandKit.gradients);
            baseJson.brandKit.characterStyles = mergeArraysById(baseJson.brandKit.characterStyles, srcJson.brandKit.characterStyles);
            baseJson.brandKit.paragraphStyles = mergeArraysById(baseJson.brandKit.paragraphStyles, srcJson.brandKit.paragraphStyles);
            baseJson.brandKit.fontFamilies = mergeArraysById(baseJson.brandKit.fontFamilies, srcJson.brandKit.fontFamilies);
            baseJson.brandKit.media = mergeArraysById(baseJson.brandKit.media, srcJson.brandKit.media);
            baseJson.brandKit.themes = mergeArraysById(baseJson.brandKit.themes, srcJson.brandKit.themes);
        }

        // 5. 合并 Variables, Connectors, Actions
        baseJson.variables = mergeArraysById(baseJson.variables, srcJson.variables);
        baseJson.connectors = mergeArraysById(baseJson.connectors, srcJson.connectors);
        baseJson.actions = mergeArraysById(baseJson.actions, srcJson.actions);

        return baseJson;
    }

    // 主执行流程
    async function processMerge() {
        showStatus(""); // 清空状态
        
        // 获取页面上所有的 input[type="file"]
        const inputs = Array.from(document.querySelectorAll('.json-input'));
        
        // 过滤出真正选择了文件的 input
        const validFiles = inputs.map(input => input.files[0]).filter(file => file !== undefined);

        if (validFiles.length < 2) {
            showStatus("At least one main template and one sub-template must be selected！", true);
            return;
        }

        try {
            document.getElementById('mergeBtn').disabled = true;
            document.getElementById('mergeBtn').textContent = "Processing...";

            // 1. 读取并解析主文件 (基准)
            const baseContent = await readFileContent(validFiles[0]);
            let mergedData = JSON.parse(baseContent);

            // 2. 循环遍历后续所有子文件，依次叠加合并
            for (let i = 1; i < validFiles.length; i++) {
                const srcContent = await readFileContent(validFiles[i]);
                const srcData = JSON.parse(srcContent);
                mergedData = mergeSingleJson(mergedData, srcData);
            }

            mergedData.flags = 1; // 保持数据标志位一致

            // 3. 生成并下载最终 JSON
            const blob = new Blob([JSON.stringify(mergedData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `merged_${validFiles.length}_templates.json`;
            a.click();
            URL.revokeObjectURL(url);

            showStatus(`✅ Successfully merged  ${validFiles.length} Successfully merged ！`);

        } catch (error) {
            console.error(error);
            showStatus("❌ Merge failed. Please check if the file format is valid, or check the console for errors。", true);
        } finally {
            document.getElementById('mergeBtn').disabled = false;
            document.getElementById('mergeBtn').textContent = "Merge & Download JSON";
        }
    }