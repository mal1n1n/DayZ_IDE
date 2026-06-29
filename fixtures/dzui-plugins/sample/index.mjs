export default {
  activate(context) {
    return {
      id: context.plugin.id,
      status: "ready",
      commands: {
        "sample.tools.refresh"({ args, command, plugin }) {
          return {
            ok: true,
            pluginId: plugin.id,
            commandId: command.id,
            value: args?.value ?? null,
          };
        },
      },
    };
  },
};
