const container = document.getElementById('fileInputsContainer');
    const addFileBtn = document.getElementById('addFileBtn');
    const mergeBtn = document.getElementById('mergeBtn');
    const logEl = document.getElementById('log');
    
    let fileIndex = 2; // 当前文件框的初始编号

    // 动态添加文件上传框
    addFileBtn.addEventListener('click', () => {
        fileIndex++;
        const box = document.createElement('div');
        box.className = 'file-box';
        box.innerHTML = `
            <div class="box-header">
                <label>Merge and download JSON ${fileIndex}</label>
                <span class="remove-btn" onclick="this.parentElement.parentElement.remove()">❌ Delete</span>
            </div>
            <input type="file" class="json-file-input" accept=".json">
        `;
        container.appendChild(box);
    });

    function log(message) {
        logEl.style.display = 'block';
        logEl.textContent += message + "\n";
        logEl.scrollTop = logEl.scrollHeight; // 自动滚动到底部
    }

    // 根据主键去重数组
    function deduplicateArray(arr1, arr2, key = 'id') {
        const safeArr1 = arr1 || [];
        const safeArr2 = arr2 || [];
        const map = new Map();
        
        safeArr1.forEach(item => {
            if (item && item[key]) map.set(item[key], item);
            else map.set(JSON.stringify(item), item); 
        });
        
        safeArr2.forEach(item => {
            if (item && item[key]) {
                if (!map.has(item[key])) map.set(item[key], item);
            } else {
                if (!map.has(JSON.stringify(item))) map.set(JSON.stringify(item), item);
            }
        });
        return Array.from(map.values());
    }

    // 核心合并逻辑：将 t2 追加进 t1
    function mergeChiliJSON(t1, t2, currentIndex) {
        log(`\n--- mergering  ${currentIndex} template ---`);
        const result = JSON.parse(JSON.stringify(t1)); // 深拷贝作为基底

        // 1. 合并图层 (Frames)
        if (result.pages && result.pages[0] && t2.pages && t2.pages[0]) {
            result.pages[0].frames.push(...t2.pages[0].frames);
        }

        // 2. 合并布局 (Layouts)
        const t1TopLayout = result.layouts.find(l => l.type === 'top');
        const t2TopLayout = t2.layouts.find(l => l.type === 'top');

        if (t1TopLayout && t2TopLayout) {
            // 合并顶级属性
            t1TopLayout.frameProperties.push(...t2TopLayout.frameProperties);
            t1TopLayout.childLayouts.push(...t2TopLayout.childLayouts);

            // 合并 Toolbar 脚本/映射
            if (t1TopLayout.privateData?.toolbar && t2TopLayout.privateData?.toolbar) {
                try {
                    const tb1 = JSON.parse(t1TopLayout.privateData.toolbar);
                    const tb2 = JSON.parse(t2TopLayout.privateData.toolbar);
                    if (tb1.layoutMaps && tb2.layoutMaps) {
                        tb1.layoutMaps.push(...tb2.layoutMaps);
                    }
                    t1TopLayout.privateData.toolbar = JSON.stringify(tb1);
                } catch (e) {
                    log("⚠️ An error occurred while parsing the toolbar JSON: " + e.message);
                }
            }

            // 追加子布局并修正 parentId
            t2.layouts.forEach(l => {
                if (l.type !== 'top') {
                    if (l.parentId === t2TopLayout.id) {
                        l.parentId = t1TopLayout.id;
                    }
                    result.layouts.push(l);
                }
            });
        }

        // 3. 合并 BrandKit
        if (result.brandKit && t2.brandKit) {
            result.brandKit.colors = deduplicateArray(result.brandKit.colors, t2.brandKit.colors, 'id');
            result.brandKit.gradients = deduplicateArray(result.brandKit.gradients, t2.brandKit.gradients, 'id');
            result.brandKit.characterStyles = deduplicateArray(result.brandKit.characterStyles, t2.brandKit.characterStyles, 'id');
            result.brandKit.paragraphStyles = deduplicateArray(result.brandKit.paragraphStyles, t2.brandKit.paragraphStyles, 'id');
            result.brandKit.fontFamilies = deduplicateArray(result.brandKit.fontFamilies, t2.brandKit.fontFamilies, 'id');
            result.brandKit.media = deduplicateArray(result.brandKit.media, t2.brandKit.media, 'id');
            result.brandKit.themes = deduplicateArray(result.brandKit.themes, t2.brandKit.themes, 'id');
        }

        // 4. 合并并去重 Variables, Connectors, Actions
        if (t2.variables) result.variables = deduplicateArray(result.variables, t2.variables, 'id');
        if (t2.connectors) result.connectors = deduplicateArray(result.connectors, t2.connectors, 'id');
        if (t2.actions) result.actions = deduplicateArray(result.actions, t2.actions, 'id');

        result.flags = 1;
        log(`✅ merged_${currentIndex}_templates.json`);
        
        return result;
    }

    function readJsonFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => {
                try {
                    resolve(JSON.parse(e.target.result));
                } catch (err) {
                    reject(new Error(`[${file.name}] Invalid JSON format`));
                }
            };
            reader.onerror = () => reject(new Error(`Failed to read file [${file.name}]`));
            reader.readAsText(file);
        });
    }

    // 执行多文件合并
    mergeBtn.addEventListener('click', async () => {
        // 抓取所有上传了文件的 input
        const inputs = Array.from(document.querySelectorAll('.json-file-input'));
        const files = inputs.map(input => input.files[0]).filter(file => file != null);

        logEl.textContent = '';
        logEl.style.display = 'none';

        if (files.length < 2) {
            alert('At least one main template and one sub-template must be selected！');
            return;
        }

        mergeBtn.disabled = true;
        mergeBtn.textContent = 'Merging in progress...';

        try {
            log(`🔄 start loading ${files.length} flie...`);
            
            // 并发读取所有文件
            const jsons = await Promise.all(files.map(f => readJsonFile(f)));
            log("🔄 File read successfully, starting chained merge...");

            // 核心: 利用 reduce 逐个合成，acc 是累计的最终结果，curr 是当前待合并的 JSON
            const mergedJSON = jsons.reduce((acc, curr, index) => {
                if (index === 0) return acc; // 第一个直接作为基底
                // 从第 2 个文件开始与之前的合并结果 acc 进行合并
                return mergeChiliJSON(acc, curr, index + 1);
            }, jsons[0]);

            log("\n🎉 All templates have been merged. Ready to download the final file!");

            // 触发下载
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(mergedJSON, null, 2));
            const dlAnchorElem = document.createElement('a');
            dlAnchorElem.setAttribute("href", dataStr);
            dlAnchorElem.setAttribute("download", `merged_${files.length}_templates.json`);
            dlAnchorElem.click();

        } catch (error) {
            log("\n❌ Error occurred: " + error.message);
            alert("Error occurred: " + error.message);
        } finally {
            mergeBtn.disabled = false;
            mergeBtn.textContent = '🚀 Merge and download JSON';
        }
    });
