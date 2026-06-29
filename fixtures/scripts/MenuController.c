class MenuController
{
 void Init()
 {
  Widget root = GetGame().GetWorkspace().CreateWidgets("layouts/arena_bot_minimal.layout");
  Widget title = root.FindAnyWidget("Title");
  Widget missing = root.FindAnyWidget("MissingWidget");
  TextWidget.Cast(title).SetText("#STR_ARENA_TITLE");
  TextWidget.Cast(missing).SetText("#STR_SCRIPT_MISSING");
  ImageWidget image;
  image.LoadImageFile(0, "MG_Arena/gui/data/header.edds");
 }
}
