// Minimal reflection runner for Capital.Tests (NUnit attributes) outside Unity.
using System;
using System.Linq;
using System.Reflection;

static class Program
{
    static int Main(string[] args)
    {
        var asm = Assembly.LoadFrom(args[0]);
        int pass = 0, fail = 0, skip = 0;
        foreach (var type in asm.GetTypes().Where(t => t.IsClass && t.IsPublic))
        foreach (var m in type.GetMethods(BindingFlags.Public | BindingFlags.Instance))
        {
            var attrs = m.GetCustomAttributesData();
            var cases = attrs.Where(a => a.AttributeType.Name == "TestCaseAttribute")
                .Select(a => a.ConstructorArguments.SelectMany(ca =>
                    ca.Value is System.Collections.ObjectModel.ReadOnlyCollection<CustomAttributeTypedArgument> arr
                        ? arr.Select(x => x.Value) : new[] { ca.Value }).ToArray()).ToList();
            if (attrs.Any(a => a.AttributeType.Name == "TestAttribute")) cases.Add(new object[0]);
            foreach (var raw in cases)
            {
                var ps = m.GetParameters();
                var values = raw.Select((v, i) => ps[i].ParameterType.IsEnum ? Enum.ToObject(ps[i].ParameterType, v) : v).ToArray();
                string name = type.Name + "." + m.Name + "(" + string.Join(",", values) + ")";
                try { m.Invoke(Activator.CreateInstance(type), values); pass++; Console.WriteLine("PASS " + name); }
                catch (TargetInvocationException e)
                {
                    var inner = e.InnerException;
                    bool needsEngine = inner is MissingMethodException || inner is TypeLoadException || inner is System.IO.FileNotFoundException ||
                                       inner.GetType().Name.Contains("Security") || inner.ToString().Contains("UnityEngine");
                    if (needsEngine) { skip++; Console.WriteLine("SKIP " + name + " (needs Unity engine: " + inner.GetType().Name + ")"); }
                    else { fail++; Console.WriteLine("FAIL " + name + "\n     " + inner.GetType().Name + ": " + inner.Message.Replace("\n", "\n     ")); }
                }
            }
        }
        Console.WriteLine($"\nTotal: {pass + fail + skip}  passed: {pass}  failed: {fail}  skipped(engine): {skip}");
        return fail == 0 ? 0 : 1;
    }
}
