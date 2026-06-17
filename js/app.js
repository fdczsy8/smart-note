const STORAGE_KEY = 'stickyNotesAppData';
        const THEME_KEY = 'stickyNotesTheme';

        let currentEditId = null;
        let currentSort = 'date-desc';
        let currentTheme = 'theme-default';
        let currentPage = 1;
        let notesPerPage = 9;
        let currentFilter = 'all';

        document.addEventListener('DOMContentLoaded', function() {
            loadTheme();
            loadNotes();
            setupEventListeners();
            updateNoteCount();
        });

        function loadTheme() {
            const savedTheme = localStorage.getItem(THEME_KEY);
            if (savedTheme) {
                currentTheme = savedTheme;
                document.body.className = savedTheme;
                document.getElementById('theme-select').value = savedTheme;
            }
        }

        function switchTheme(theme) {
            document.body.className = theme;
            currentTheme = theme;
            localStorage.setItem(THEME_KEY, theme);
            document.getElementById('theme-select').value = theme;
            showToast('主题已切换');
        }

        function loadNotes() {
            const notesContainer = document.getElementById('notes-container');
            let notes = getNotesFromStorage();

            notes = filterNotes(notes, currentFilter);
            notesContainer.innerHTML = '';

            if (notes.length === 0) {
                notesContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-clipboard-list"></i>
                        <h3>暂无便签</h3>
                        <p>点击新建便签开始记录</p>
                    </div>
                `;
                document.getElementById('pagination-container').style.display = 'none';
                return;
            }

            const sortedNotes = sortNotes(notes, currentSort);
            const totalPages = Math.ceil(sortedNotes.length / notesPerPage);

            if (currentPage > totalPages) {
                currentPage = totalPages || 1;
            }

            const startIndex = (currentPage - 1) * notesPerPage;
            const endIndex = startIndex + notesPerPage;
            const currentPageNotes = sortedNotes.slice(startIndex, endIndex);

            currentPageNotes.forEach(note => {
                const noteElement = createNoteElement(note);
                notesContainer.appendChild(noteElement);
            });

            renderPagination(totalPages);
        }

        function filterNotes(notes, filterType) {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

            switch(filterType) {
                case 'all': return notes;
                case 'active': return notes.filter(note => !note.completed);
                case 'completed': return notes.filter(note => note.completed);
                case 'important':
                    return notes.filter(note =>
                        note.tags && note.tags.some(tag =>
                            tag.toLowerCase().includes('重要') ||
                            tag.toLowerCase().includes('紧急') ||
                            tag.toLowerCase().includes('priority')
                        )
                    );
                case 'today':
                    return notes.filter(note => new Date(note.date).getTime() >= todayStart);
                default: return notes;
            }
        }

        function sortNotes(notes, sortType) {
            const sortedNotes = [...notes];

            // 优先级排序: high > medium > low
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            sortedNotes.sort((a, b) => {
                const pa = priorityOrder[a.priority] !== undefined ? priorityOrder[a.priority] : 1;
                const pb = priorityOrder[b.priority] !== undefined ? priorityOrder[b.priority] : 1;
                return pa - pb;
            });

            // 在每个优先级组内应用选择的排序
            const priorityGroups = {};
            sortedNotes.forEach(note => {
                const p = note.priority || 'low';
                if (!priorityGroups[p]) priorityGroups[p] = [];
                priorityGroups[p].push(note);
            });

            function sortGroup(group) {
                switch(sortType) {
                    case 'date-desc':
                        return group.sort((a, b) => new Date(b.date) - new Date(a.date));
                    case 'date-asc':
                        return group.sort((a, b) => new Date(a.date) - new Date(b.date));
                    case 'title-asc':
                        return group.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
                    case 'title-desc':
                        return group.sort((a, b) => b.title.localeCompare(a.title, 'zh-CN'));
                    case 'completed':
                        return group.sort((a, b) => {
                            if (a.completed && !b.completed) return 1;
                            if (!a.completed && b.completed) return -1;
                            return new Date(b.date) - new Date(a.date);
                        });
                    default:
                        return group.sort((a, b) => new Date(b.date) - new Date(a.date));
                }
            }

            const result = [];
            ['high', 'medium', 'low'].forEach(p => {
                if (priorityGroups[p]) {
                    result.push(...sortGroup(priorityGroups[p]));
                }
            });
            return result;
        }

        function getNotesFromStorage() {
            const notesJSON = localStorage.getItem(STORAGE_KEY);
            const notes = notesJSON ? JSON.parse(notesJSON) : [];
            return notes.map(note => ({
                ...note,
                completed: note.completed || false,
                priority: note.priority || 'low'
            }));
        }

        function saveNotesToStorage(notes) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
        }

        function createNoteElement(note) {
            const noteElement = document.createElement('div');
            noteElement.className = 'note';
            if (note.completed) {
                noteElement.classList.add('completed');
            }
            noteElement.style.backgroundColor = note.color || '#ffffff';

            // 根据背景色亮度自动适配字体颜色，确保对比度
            const textColor = getContrastColor(note.color || '#ffffff');
            noteElement.style.color = textColor;
            noteElement.style.setProperty('--card-text', textColor);
            noteElement.style.setProperty('--card-text-secondary', textColor === '#ffffff' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)');

            const date = new Date(note.date);
            const formattedDate = date.toLocaleDateString('zh-CN', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
            const relativeTime = getRelativeTime(date);

            let tagsHTML = '';
            if (note.tags && note.tags.length > 0) {
                tagsHTML = note.tags.map(tag => `<span class="tag">${tag.trim()}</span>`).join('');
            }

            const priority = note.priority || 'low';
            const priorityLabel = priority === 'high' ? '高' : priority === 'low' ? '低' : '中';

            noteElement.innerHTML = `
                <div class="note-header">
                    <div class="note-title">${note.title}</div>
                    <div class="note-actions">
                        <button class="note-action-btn complete-btn" data-id="${note.id}" title="${note.completed ? '标记为未完成' : '标记为完成'}">
                            <i class="fas ${note.completed ? 'fa-undo' : 'fa-check'}"></i>
                        </button>
                        <button class="note-action-btn edit-note" data-id="${note.id}" title="编辑">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="note-action-btn delete-note" data-id="${note.id}" title="删除">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="note-content">${note.content.replace(/\n/g, '<br>')}</div>
                <div class="note-footer">
                    ${tagsHTML ? `<div class="note-tags">${tagsHTML}</div>` : ''}
                    <span class="priority-badge ${priority}">${priorityLabel}</span>
                </div>
                <div class="note-date">
                    <i class="far fa-clock"></i>
                    <span title="${formattedDate}">${formattedDate}</span>
                    <span style="color: var(--text-secondary); font-size: 12px;">(${relativeTime})</span>
                </div>
            `;

            noteElement.querySelector('.complete-btn').addEventListener('click', () => toggleNoteComplete(note.id));
            noteElement.querySelector('.edit-note').addEventListener('click', () => editNote(note.id));
            noteElement.querySelector('.delete-note').addEventListener('click', () => deleteNote(note.id));

            return noteElement;
        }

        // 根据背景色计算应使用的文字颜色，确保对比度
        function getContrastColor(hexColor) {
            const r = parseInt(hexColor.slice(1, 3), 16);
            const g = parseInt(hexColor.slice(3, 5), 16);
            const b = parseInt(hexColor.slice(5, 7), 16);
            // 相对亮度计算 (sRGB)
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            return luminance > 0.55 ? '#1e293b' : '#ffffff';
        }

        function getRelativeTime(date) {
            const now = new Date();
            const diffMs = now - date;
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHour = Math.floor(diffMin / 60);
            const diffDay = Math.floor(diffHour / 24);

            if (diffSec < 60) return '刚刚';
            if (diffMin < 60) return `${diffMin}分钟前`;
            if (diffHour < 24) return `${diffHour}小时前`;
            if (diffDay < 7) return `${diffDay}天前`;
            return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
        }

        function renderPagination(totalPages) {
            const paginationContainer = document.getElementById('pagination-container');

            if (totalPages <= 1) {
                paginationContainer.style.display = 'none';
                return;
            }

            paginationContainer.style.display = 'flex';

            let paginationHTML = '';

            paginationHTML += `
                <button class="pagination-btn" id="prev-page" ${currentPage === 1 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i>
                </button>
            `;

            const maxVisiblePages = 5;
            let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
            let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

            if (endPage - startPage + 1 < maxVisiblePages) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
            }

            if (startPage > 1) {
                paginationHTML += `<button class="pagination-btn page-btn" data-page="1">1</button>`;
                if (startPage > 2) paginationHTML += '<span class="pagination-dots">...</span>';
            }

            for (let i = startPage; i <= endPage; i++) {
                paginationHTML += `<button class="pagination-btn page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) paginationHTML += '<span class="pagination-dots">...</span>';
                paginationHTML += `<button class="pagination-btn page-btn" data-page="${totalPages}">${totalPages}</button>`;
            }

            paginationHTML += `
                <button class="pagination-btn" id="next-page" ${currentPage === totalPages ? 'disabled' : ''}>
                    <i class="fas fa-chevron-right"></i>
                </button>
            `;

            paginationContainer.innerHTML = paginationHTML;

            document.getElementById('prev-page').addEventListener('click', () => {
                if (currentPage > 1) { currentPage--; loadNotes(); scrollToTop(); }
            });

            document.getElementById('next-page').addEventListener('click', () => {
                if (currentPage < totalPages) { currentPage++; loadNotes(); scrollToTop(); }
            });

            document.querySelectorAll('.page-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    currentPage = parseInt(this.getAttribute('data-page'));
                    loadNotes();
                    scrollToTop();
                });
            });
        }

        function scrollToTop() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function setupEventListeners() {
            document.getElementById('add-note-btn').addEventListener('click', () => openNoteModal());

            document.getElementById('theme-select').addEventListener('change', function() {
                switchTheme(this.value);
            });

            document.getElementById('close-modal').addEventListener('click', () => closeNoteModal());
            document.getElementById('cancel-note').addEventListener('click', () => closeNoteModal());
            document.getElementById('note-form').addEventListener('submit', saveNote);

            document.getElementById('search-input').addEventListener('input', searchNotes);

            document.getElementById('sort-select').addEventListener('change', function() {
                currentSort = this.value;
                currentPage = 1;
                updateSortIndicator();
                loadNotes();
            });

            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const filter = this.getAttribute('data-filter');
                    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    currentFilter = filter;
                    currentPage = 1;
                    loadNotes();
                });
            });

            document.getElementById('page-size-select').addEventListener('change', function() {
                notesPerPage = parseInt(this.value);
                currentPage = 1;
                loadNotes();
            });

            document.getElementById('export-btn').addEventListener('click', exportData);
            document.getElementById('import-btn').addEventListener('click', () => openImportModal());
            document.getElementById('close-import-modal').addEventListener('click', () => closeImportModal());
            document.getElementById('cancel-import').addEventListener('click', () => closeImportModal());
            document.getElementById('confirm-import').addEventListener('click', () => {
                const importDataText = document.getElementById('import-data').value.trim();
                if (importDataText) {
                    processImportData(importDataText);
                } else {
                    showToast('请粘贴数据或选择文件', 'warning');
                }
            });
            document.getElementById('clear-all-btn').addEventListener('click', clearAllNotes);

            // 文件拖拽和选择
            const dropZone = document.getElementById('import-drop-zone');
            const fileInput = document.getElementById('import-file-input');
            const fileNameSpan = document.getElementById('import-file-name');

            dropZone.addEventListener('click', () => fileInput.click());

            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-over');
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('drag-over');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                const file = e.dataTransfer.files[0];
                if (file) handleImportFile(file);
            });

            fileInput.addEventListener('change', () => {
                const file = fileInput.files[0];
                if (file) handleImportFile(file);
            });

            document.querySelectorAll('.color-option').forEach(option => {
                option.addEventListener('click', function() {
                    const color = this.getAttribute('data-color');
                    document.getElementById('note-color').value = color;
                    document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
                    this.classList.add('selected');
                });
            });

            document.querySelectorAll('.priority-option').forEach(option => {
                option.addEventListener('click', function() {
                    const priority = this.getAttribute('data-priority');
                    document.getElementById('note-priority').value = priority;
                    document.querySelectorAll('.priority-option').forEach(opt => opt.classList.remove('selected'));
                    this.classList.add('selected');
                });
            });

            window.addEventListener('click', function(event) {
                if (event.target === document.getElementById('note-modal')) closeNoteModal();
                if (event.target === document.getElementById('import-modal')) closeImportModal();
            });
        }

        function toggleNoteComplete(noteId) {
            const notes = getNotesFromStorage();
            const noteIndex = notes.findIndex(n => n.id === noteId);
            if (noteIndex !== -1) {
                notes[noteIndex].completed = !notes[noteIndex].completed;
                notes[noteIndex].date = new Date().toISOString();
                saveNotesToStorage(notes);
                loadNotes();
                updateNoteCount();
                showToast(notes[noteIndex].completed ? '便签已标记为完成' : '便签已标记为未完成');
            }
        }

        function updateSortIndicator() {
            const sortSelect = document.getElementById('sort-select');
            const selectedOption = sortSelect.options[sortSelect.selectedIndex];
            document.getElementById('sort-indicator').textContent = selectedOption.text;
        }

        function openNoteModal(noteId = null) {
            currentEditId = noteId;
            const modal = document.getElementById('note-modal');
            const modalTitle = document.getElementById('modal-title');
            const form = document.getElementById('note-form');

            if (noteId) {
                modalTitle.textContent = '编辑便签';
                const notes = getNotesFromStorage();
                const note = notes.find(n => n.id === noteId);
                if (note) {
                    document.getElementById('note-title').value = note.title;
                    document.getElementById('note-content').value = note.content;
                    document.getElementById('note-tags').value = note.tags ? note.tags.join(', ') : '';
                    document.getElementById('note-color').value = note.color || '#ffffff';
                    setPriorityOption(note.priority || 'low');
                    document.querySelectorAll('.color-option').forEach(opt => {
                        opt.classList.remove('selected');
                        if (opt.getAttribute('data-color') === (note.color || '#ffffff')) {
                            opt.classList.add('selected');
                        }
                    });
                }
            } else {
                modalTitle.textContent = '新建便签';
                form.reset();
                document.getElementById('note-color').value = '#ffffff';
                setPriorityOption('low');
                document.querySelectorAll('.color-option').forEach(opt => {
                    opt.classList.remove('selected');
                    if (opt.getAttribute('data-color') === '#ffffff') opt.classList.add('selected');
                });
            }

            modal.style.display = 'flex';
            document.getElementById('note-title').focus();
        }

        function closeNoteModal() {
            document.getElementById('note-modal').style.display = 'none';
            currentEditId = null;
        }

        function setPriorityOption(priority) {
            document.getElementById('note-priority').value = priority;
            document.querySelectorAll('.priority-option').forEach(opt => {
                opt.classList.remove('selected');
                if (opt.getAttribute('data-priority') === priority) {
                    opt.classList.add('selected');
                }
            });
        }

        function saveNote(event) {
            event.preventDefault();

            const title = document.getElementById('note-title').value.trim();
            const content = document.getElementById('note-content').value.trim();
            const tagsInput = document.getElementById('note-tags').value.trim();
            const color = document.getElementById('note-color').value;
            const priority = document.getElementById('note-priority').value;

            if (!title || !content) {
                showToast('标题和内容不能为空', 'error');
                return;
            }

            const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
            const notes = getNotesFromStorage();

            if (currentEditId) {
                const noteIndex = notes.findIndex(n => n.id === currentEditId);
                if (noteIndex !== -1) {
                    notes[noteIndex] = { ...notes[noteIndex], title, content, tags, color, priority, date: new Date().toISOString() };
                }
            } else {
                notes.push({
                    id: Date.now().toString(),
                    title, content, tags, color, priority,
                    completed: false,
                    date: new Date().toISOString()
                });
            }

            saveNotesToStorage(notes);
            loadNotes();
            closeNoteModal();
            updateNoteCount();
            showToast(currentEditId ? '便签已更新' : '便签已添加');
        }

        function editNote(noteId) {
            openNoteModal(noteId);
        }

        function deleteNote(noteId) {
            if (!confirm('确定要删除这个便签吗？')) return;
            const notes = getNotesFromStorage();
            saveNotesToStorage(notes.filter(note => note.id !== noteId));
            loadNotes();
            updateNoteCount();
            showToast('便签已删除');
        }

        function searchNotes() {
            const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
            const notesContainer = document.getElementById('notes-container');
            let notes = getNotesFromStorage();

            notes = filterNotes(notes, currentFilter);
            notesContainer.innerHTML = '';

            if (searchTerm === '') {
                loadNotes();
                return;
            }

            const filteredNotes = notes.filter(note => {
                return note.title.toLowerCase().includes(searchTerm) ||
                       note.content.toLowerCase().includes(searchTerm) ||
                       (note.tags && note.tags.some(tag => tag.toLowerCase().includes(searchTerm)));
            });

            if (filteredNotes.length === 0) {
                notesContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-search"></i>
                        <h3>未找到匹配的便签</h3>
                        <p>尝试使用其他关键词搜索</p>
                    </div>
                `;
                document.getElementById('pagination-container').style.display = 'none';
                return;
            }

            const sortedNotes = sortNotes(filteredNotes, currentSort);
            const totalPages = Math.ceil(sortedNotes.length / notesPerPage);
            if (currentPage > totalPages) currentPage = totalPages || 1;

            const startIndex = (currentPage - 1) * notesPerPage;
            sortedNotes.slice(startIndex, startIndex + notesPerPage).forEach(note => {
                notesContainer.appendChild(createNoteElement(note));
            });

            renderPagination(totalPages);
        }

        function exportData() {
            const notes = getNotesFromStorage();
            if (notes.length === 0) {
                showToast('没有可导出的便签数据', 'warning');
                return;
            }
            const dataStr = JSON.stringify(notes, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', `便签数据_${new Date().toISOString().slice(0, 10)}.json`);
            linkElement.click();
            showToast('数据已导出');
        }

        function openImportModal() {
            document.getElementById('import-modal').style.display = 'flex';
            document.getElementById('import-data').focus();
        }

        function closeImportModal() {
            document.getElementById('import-modal').style.display = 'none';
            document.getElementById('import-data').value = '';
            document.getElementById('import-file-input').value = '';
            document.getElementById('import-file-name').style.display = 'none';
        }

        function handleImportFile(file) {
            if (!file.name.endsWith('.json')) {
                showToast('请选择JSON文件', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = function(e) {
                const importDataText = document.getElementById('import-data');
                importDataText.value = e.target.result;
                document.getElementById('import-file-name').textContent = file.name;
                document.getElementById('import-file-name').style.display = 'block';
                showToast('文件已加载，确认后点击导入数据');
            };
            reader.onerror = function() {
                showToast('文件读取失败', 'error');
            };
            reader.readAsText(file);
        }

        function processImportData(importDataText) {
            if (!importDataText) {
                showToast('请输入要导入的数据', 'error');
                return;
            }
            try {
                const importedNotes = JSON.parse(importDataText);
                if (!Array.isArray(importedNotes)) throw new Error('导入数据格式不正确');
                for (let note of importedNotes) {
                    if (!note.id || !note.title || !note.content || !note.date) {
                        throw new Error('导入数据格式不正确');
                    }
                }
                const existingNotes = getNotesFromStorage();
                const existingIds = new Set(existingNotes.map(note => note.id));
                const newNotes = importedNotes.filter(note => !existingIds.has(note.id));
                if (newNotes.length === 0) {
                    showToast('没有新的便签可导入', 'warning');
                    closeImportModal();
                    return;
                }
                saveNotesToStorage([...existingNotes, ...newNotes]);
                loadNotes();
                updateNoteCount();
                closeImportModal();
                showToast(`成功导入 ${newNotes.length} 个便签`);
            } catch (error) {
                showToast('导入失败: ' + error.message, 'error');
            }
        }

        function clearAllNotes() {
            if (!confirm('确定要清空所有便签吗？此操作不可撤销！')) return;
            localStorage.removeItem(STORAGE_KEY);
            loadNotes();
            updateNoteCount();
            showToast('所有便签已清空');
        }

        function updateNoteCount() {
            const notes = getNotesFromStorage();
            document.getElementById('note-count').textContent = notes.length;
            document.getElementById('completed-count').textContent = notes.filter(note => note.completed).length;
        }

        function showToast(message, type = 'success') {
            const toast = document.getElementById('toast');
            const toastMessage = document.getElementById('toast-message');
            const toastIcon = toast.querySelector('.toast-icon i');
            toastMessage.textContent = message;

            const now = new Date();
            document.getElementById('toast-time').textContent =
                now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

            if (type === 'error') {
                toast.style.borderLeftColor = '#ef4444';
                toastIcon.className = 'fas fa-exclamation-circle';
            } else if (type === 'warning') {
                toast.style.borderLeftColor = '#f59e0b';
                toastIcon.className = 'fas fa-exclamation-triangle';
            } else {
                toast.style.borderLeftColor = 'var(--primary)';
                toastIcon.className = 'fas fa-check';
            }

            toast.classList.add('show');
            setTimeout(() => { toast.classList.remove('show'); }, 3000);
        }

        function addSampleDataIfEmpty() {
            const notes = getNotesFromStorage();
            if (notes.length === 0) {
                const sampleNotes = [
                    {
                        id: "1",
                        title: "更多工具尽在忆痕发布页",
                        content: "www.937788.xyz",
                        tags: [],
                        color: "#ffffff",
                        priority: "high",
                        completed: false,
                        date: new Date().toISOString()
                    }
                ];

                saveNotesToStorage(sampleNotes);
                loadNotes();
                updateNoteCount();
                updateSortIndicator();
                showToast('已加载示例数据');
            }
        }

        setTimeout(addSampleDataIfEmpty, 800);