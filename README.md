# Page Markup Copy

A Manifest V3 Chrome/Edge extension that keeps the page you are browsing untouched. Click the extension icon and it opens the same URL in a new tab, where you can draw, circle, highlight areas, and add text notes.

## Install locally

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this folder.
4. Open a normal `http` or `https` page and click **Page Markup Copy** in the browser toolbar.

The controls appear as a vertical palette on the right side of the copied page. Drag the **Edit copy** header to put the palette anywhere on screen, or collapse it to the small pencil button and click that button to open it again. The Shape menu supports circles, rectangles, squares, and triangles. Choose **Move**, then drag any existing drawing, shape, or highlighted area to reposition it. Choose **PNG image**, **JPEG image**, or **Word document**, then use **Save**. The saved file is a capture of the visible part of the annotated page. The Word option is a Word-compatible `.doc` file containing that capture. The original tab is never edited. Browser internal pages (`chrome://`, extension pages, and similar protected pages) cannot be copied or annotated by browser extensions.

Use **Undo** and **Redo** to step through annotation changes. To remove one drawing only, choose **Move**, click the drawing (it gains a blue outline), then select **Delete selected**. **Clear** removes all annotations and text notes; it can be undone.
